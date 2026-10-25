import { GITHUB_TOKEN } from '$app/env/private';
import type { Activity, LanguageShare, Repo, RepoMedia } from './github';

const USER = 'slastra';
const TTL_MS = 10 * 60 * 1000;

// Refetch sooner than TTL when the previous attempt errored, so a transient failure
// (rate-limit, network blip) doesn't pin stale data for the full TTL window.
const ERROR_BACKOFF_MS = 30 * 1000;

export function githubHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'User-Agent': 'dev.lastra.us'
	};
	if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
	return headers;
}

type RepoApiPayload = {
	name: string;
	description: string | null;
	html_url: string;
	homepage: string | null;
	language: string | null;
	stargazers_count: number;
	forks_count: number;
	archived: boolean;
	pushed_at: string;
	created_at: string;
	topics?: string[];
	license: { spdx_id: string | null } | null;
	fork: boolean;
};

type CacheEntry = { repos: Repo[]; fetchedAt: number; activity: Activity | null };
let cache: CacheEntry | null = null;
let lastError: { at: number; message: string } | null = null;
let inflight: Promise<CacheEntry> | null = null;

const MEDIA_RE = /^(screenshot|demo)\.(mp4|webm|mov|m4v|png|jpe?g|webp|gif|avif|svg)$/i;

const VIDEO_TYPES: Record<string, string> = {
	mp4: 'video/mp4',
	m4v: 'video/mp4',
	webm: 'video/webm',
	mov: 'video/quicktime'
};

const IMAGE_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif',
	svg: 'image/svg+xml'
};

// One GraphQL request returns the root and docs/ trees, README and language bytes for every repo,
// plus the contribution calendar, at once, which keeps all of it at a flat 1 API call instead of
// several per repo. GraphQL requires a token, so without one we skip it entirely rather than spend
// the 60/hr anonymous REST budget; cards then go without banners, the language strip without its
// code view and the header without its activity strip.
const EXTRAS_QUERY = `query($login: String!) {
	user(login: $login) {
		contributionsCollection {
			contributionCalendar { weeks { contributionDays { date contributionCount } } }
		}
		repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
			nodes {
				name
				root: object(expression: "HEAD:") { ... on Tree { entries { name type } } }
				docs: object(expression: "HEAD:docs") { ... on Tree { entries { name type } } }
				readme: object(expression: "HEAD:README.md") { ... on Blob { text } }
				languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
					edges { size node { name } }
				}
			}
		}
	}
}`;

type TreeEntry = { name: string; type: string };
type ExtrasNode = {
	name: string;
	root: { entries?: TreeEntry[] } | null;
	docs: { entries?: TreeEntry[] } | null;
	readme: { text?: string | null } | null;
	languages: { edges?: { size: number; node: { name: string } }[] } | null;
};
type ExtrasPayload = {
	data?: {
		user?: {
			repositories?: { nodes?: ExtrasNode[] };
			contributionsCollection?: {
				contributionCalendar?: {
					weeks?: { contributionDays?: { date: string; contributionCount: number }[] }[];
				};
			};
		};
	};
	errors?: { message: string }[];
};

type Extras = { media: RepoMedia | null; languages: LanguageShare[] };

type Candidate = { path: string; score: number; kind: 'video' | 'image' };

/**
 * Repos ship several of these at once — hyprglaze and dots both carry a demo.gif beside a
 * demo.mp4 — so candidates are scored rather than first-match-wins. Within a kind, docs/ beats
 * the repo root and demo beats screenshot. Video and image are ranked separately so the card
 * keeps a still to fall back to.
 */
function candidate(entry: TreeEntry, dir: string): Candidate | null {
	if (entry.type !== 'blob') return null;
	const match = MEDIA_RE.exec(entry.name);
	if (!match) return null;

	const ext = match[2].toLowerCase();
	if (!VIDEO_TYPES[ext] && !IMAGE_TYPES[ext]) return null;

	return {
		path: dir ? `${dir}/${entry.name}` : entry.name,
		score: (dir ? 2 : 0) + (match[1].toLowerCase() === 'demo' ? 1 : 0),
		kind: VIDEO_TYPES[ext] ? 'video' : 'image'
	};
}

async function loadExtras(): Promise<{ byRepo: Map<string, Extras>; activity: Activity | null }> {
	const found = new Map<string, Extras>();
	if (!GITHUB_TOKEN) return { byRepo: found, activity: null };

	const res = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
		body: JSON.stringify({ query: EXTRAS_QUERY, variables: { login: USER } })
	});
	if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);

	const body = (await res.json()) as ExtrasPayload;
	if (body.errors?.length) throw new Error(body.errors[0].message);

	for (const node of body.data?.user?.repositories?.nodes ?? []) {
		found.set(node.name, {
			media: pickMedia(node),
			languages: (node.languages?.edges ?? []).map((e) => ({ name: e.node.name, bytes: e.size }))
		});
	}
	const days = (body.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? []).flatMap(
		(w) => w.contributionDays ?? []
	);
	return { byRepo: found, activity: rollingWeeks(days) };
}

/** The calendar's days, oldest first and ending today, regrouped into 52 rolling weeks. */
function rollingWeeks(days: { date: string; contributionCount: number }[]): Activity | null {
	const year = days.slice(-52 * 7);
	if (year.length < 7) return null;
	const weeks: Activity['weeks'] = [];
	// Grouped from the newest day backwards, so a short year loses its oldest days, not today.
	for (let end = year.length; end - 7 >= 0; end -= 7) {
		const week = year.slice(end - 7, end);
		weeks.unshift({
			start: week[0].date,
			end: week[6].date,
			count: week.reduce((sum, d) => sum + d.contributionCount, 0)
		});
	}
	return { total: weeks.reduce((sum, w) => sum + w.count, 0), weeks };
}

function pickMedia(node: ExtrasNode): RepoMedia | null {
	const candidates = [
		...(node.docs?.entries ?? []).map((e) => candidate(e, 'docs')),
		...(node.root?.entries ?? []).map((e) => candidate(e, ''))
	].filter((c): c is Candidate => c !== null);

	if (!candidates.length) {
		return node.readme?.text ? readmeMedia(node.readme.text, node.name) : null;
	}

	const best = (kind: 'video' | 'image') =>
		candidates
			.filter((c) => c.kind === kind)
			.reduce<Candidate | null>((a, b) => (!a || b.score > a.score ? b : a), null);

	const video = best('video');
	const image = best('image');

	// Video has to come off jsDelivr, not raw.githubusercontent. Raw serves mp4 as
	// application/octet-stream *and* sends x-content-type-options: nosniff, which forbids
	// the browser from sniffing the container, so the element can never decode it.
	// jsDelivr serves the same blob as video/mp4. Images are fine on raw, which already
	// returns a correct image/* type.
	return {
		video: video ? `https://cdn.jsdelivr.net/gh/${USER}/${node.name}@HEAD/${video.path}` : null,
		image: image
			? `https://raw.githubusercontent.com/${USER}/${node.name}/HEAD/${image.path}`
			: null,
		fromReadme: false
	};
}

// The first picture a README shows, in document order. A bare github.com/user-attachments link on
// a line of its own is what GitHub's editor inserts for an uploaded video (tabctl), and GitHub
// renders it as a player; uploaded images come in as ![]() or <img>. Fenced code is dropped first
// so an example snippet can't be mistaken for media.
export const ATTACHMENT_LINE = /^[ \t]*(https:\/\/github\.com\/user-attachments\/assets\/[\w-]+)[ \t]*$/gm;

const README_MEDIA_RE = new RegExp(
	String.raw`<video\b[^>]*?\bsrc=["']([^"']+)["']|<img\b[^>]*?\bsrc=["']([^"']+)["']|!\[[^\]]*\]\(\s*<?([^)\s>]+)|` +
		ATTACHMENT_LINE.source,
	'gim'
);

// Status badges and other chrome that READMEs put above the real screenshot.
const NOT_A_BANNER = /shields\.io|badgen\.net|\/badge\b|badge\.svg|\/workflows\/|\.svg(?:[?#]|$)/i;

function readmeMedia(markdown: string, repo: string): RepoMedia | null {
	const prose = markdown.replace(/^(```|~~~)[\s\S]*?^\1/gm, '');

	for (const m of prose.matchAll(README_MEDIA_RE)) {
		const [, videoTag, imgTag, mdImage, bareAttachment] = m;
		const video = videoTag ?? bareAttachment;
		const url = video ?? imgTag ?? mdImage;
		if (!video && NOT_A_BANNER.test(url)) continue;

		// Relative paths mean files in the repo. Video goes through jsDelivr for the same
		// content-type reason as in pickMedia(). An uploaded video's 302 lands on a
		// short-lived signed S3 URL, which is fine: the browser follows it on every load.
		const resolve = (base: string) =>
			/^[a-z][a-z\d+.-]*:|^\/\//i.test(url) ? url : new URL(url.replace(/^\.?\/+/, ''), base).href;
		return video
			? { video: resolve(`https://cdn.jsdelivr.net/gh/${USER}/${repo}@HEAD/`), image: null, fromReadme: true }
			: { video: null, image: resolve(`https://raw.githubusercontent.com/${USER}/${repo}/HEAD/`), fromReadme: true };
	}
	return null;
}

async function load(): Promise<CacheEntry> {
	const apiUrl = `https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=updated`;

	// A media or language lookup that fails must never take the page down with it.
	const [res, extras] = await Promise.all([
		fetch(apiUrl, { headers: githubHeaders() }),
		loadExtras().catch(() => ({ byRepo: new Map<string, Extras>(), activity: null }))
	]);

	if (!res.ok) throw new Error(`GitHub API ${res.status}`);
	const raw = (await res.json()) as RepoApiPayload[];

	const repos: Repo[] = raw
		.filter((r) => !r.fork)
		.map((r) => ({
			name: r.name,
			description: r.description,
			html_url: r.html_url,
			homepage: r.homepage,
			language: r.language,
			stars: r.stargazers_count,
			forks: r.forks_count,
			archived: r.archived,
			pushed_at: r.pushed_at,
			created_at: r.created_at,
			topics: r.topics ?? [],
			// GitHub reports NOASSERTION for a LICENSE file it found but couldn't classify.
			license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : null,
			media: extras.byRepo.get(r.name)?.media ?? null,
			languages: extras.byRepo.get(r.name)?.languages ?? []
		}));

	repos.sort((a, b) => {
		if (b.stars !== a.stars) return b.stars - a.stars;
		return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
	});

	return { repos, fetchedAt: Date.now(), activity: extras.activity };
}

export async function fetchRepos(): Promise<CacheEntry & { error?: string }> {
	const now = Date.now();

	if (cache && now - cache.fetchedAt < TTL_MS) {
		if (!lastError) return cache;
		if (now - lastError.at < ERROR_BACKOFF_MS) return { ...cache, error: lastError.message };
	}

	inflight ??= load()
		.then((entry) => {
			cache = entry;
			lastError = null;
			return entry;
		})
		.finally(() => {
			inflight = null;
		});

	try {
		return await inflight;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load repos';
		lastError = { at: Date.now(), message };
		if (cache) return { ...cache, error: message };
		return { repos: [], fetchedAt: now, activity: null, error: message };
	}
}
