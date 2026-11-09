import { GITHUB_TOKEN } from '$app/env/private';
import type { Activity, LanguageShare, Repo, RepoMedia } from './github';

const USER = 'slastra';
const TTL_MS = 10 * 60 * 1000;

// When the media/language lookup partly fails, the previous values stand in and the whole entry
// expires this soon instead, so one GitHub timeout costs a minute of staleness, not ten.
const DEGRADED_TTL_MS = 60 * 1000;

// Refetch sooner than TTL when the previous attempt errored, so a transient failure
// (rate-limit, network blip) doesn't pin stale data for the full TTL window.
const ERROR_BACKOFF_MS = 30 * 1000;

// Long enough for a slow GitHub response, short enough that a hung socket can't hold the very
// first render (the only one that waits; later ones are served from cache).
const FETCH_TIMEOUT_MS = 15 * 1000;

// Repos per GraphQL request. Reading tree entries and README blobs is the slow part (a single
// query over all ~35 repos took 6-10 s and sometimes hit GitHub's 10 s limit with a 502), so the
// repos are split into small batches that run in parallel and fail independently.
const BATCH_SIZE = 6;

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

type CacheEntry = { repos: Repo[]; fetchedAt: number; expiresAt: number; activity: Activity | null };
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

// GraphQL carries everything the REST list lacks: the root and docs/ trees, README and language
// bytes of each repo, and the contribution calendar. GraphQL requires a token, so without one it is
// skipped entirely rather than spending the 60/hr anonymous REST budget; cards then go without
// banners, the language strip without its code view and the header without its activity strip.
const CALENDAR_QUERY = `query($login: String!) {
	user(login: $login) {
		contributionsCollection {
			contributionCalendar { weeks { contributionDays { date contributionCount } } }
		}
	}
}`;

const REPO_FIELDS = `
	name
	root: object(expression: "HEAD:") { ... on Tree { entries { name type } } }
	docs: object(expression: "HEAD:docs") { ... on Tree { entries { name type } } }
	readme: object(expression: "HEAD:README.md") { ... on Blob { text } }
	languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
		edges { size node { name } }
	}`;

/** One aliased `repository` lookup per name; names travel as variables, never in the query text. */
function batchQuery(count: number): string {
	const vars = Array.from({ length: count }, (_, i) => `$n${i}: String!`).join(', ');
	const fields = Array.from(
		{ length: count },
		(_, i) => `r${i}: repository(owner: $owner, name: $n${i}) {${REPO_FIELDS}\n}`
	).join('\n');
	return `query($owner: String!, ${vars}) {\n${fields}\n}`;
}

type TreeEntry = { name: string; type: string };
type ExtrasNode = {
	name: string;
	root: { entries?: TreeEntry[] } | null;
	docs: { entries?: TreeEntry[] } | null;
	readme: { text?: string | null } | null;
	languages: { edges?: { size: number; node: { name: string } }[] } | null;
};
type CalendarData = {
	user?: {
		contributionsCollection?: {
			contributionCalendar?: {
				weeks?: { contributionDays?: { date: string; contributionCount: number }[] }[];
			};
		};
	};
};
type BatchData = Record<string, ExtrasNode | null>;

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

async function graphql<T>(query: string, variables: Record<string, string>): Promise<T> {
	const res = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
		body: JSON.stringify({ query, variables }),
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
	const body = (await res.json()) as { data?: T | null; errors?: { message: string }[] };
	// A repo that can't be resolved comes back as a null field plus an error; the rest of the
	// batch is still good. Only a response with no data at all is a failure.
	if (!body.data) throw new Error(body.errors?.[0]?.message ?? 'GitHub GraphQL returned no data');
	return body.data;
}

/** The activity strip's data, null without a token. Throws if GitHub fails, so the caller can keep the last good value. */
async function loadActivity(): Promise<Activity | null> {
	if (!GITHUB_TOKEN) return null;
	const data = await graphql<CalendarData>(CALENDAR_QUERY, { login: USER });
	const days = (data.user?.contributionsCollection?.contributionCalendar?.weeks ?? []).flatMap(
		(w) => w.contributionDays ?? []
	);
	return rollingWeeks(days);
}

/**
 * Media and languages for each named repo, fetched in parallel batches. A batch that fails puts
 * its names in `failed` rather than failing the lot, so the caller can fill those in from cache.
 */
async function loadExtras(names: string[]): Promise<{ byRepo: Map<string, Extras>; failed: string[] }> {
	const byRepo = new Map<string, Extras>();
	const failed: string[] = [];
	if (!GITHUB_TOKEN) return { byRepo, failed };

	const batches: string[][] = [];
	for (let i = 0; i < names.length; i += BATCH_SIZE) batches.push(names.slice(i, i + BATCH_SIZE));

	const results = await Promise.allSettled(
		batches.map((batch) =>
			graphql<BatchData>(batchQuery(batch.length), {
				owner: USER,
				...Object.fromEntries(batch.map((name, i) => [`n${i}`, name]))
			})
		)
	);

	results.forEach((result, b) => {
		if (result.status === 'rejected') {
			console.error(`[github] media/languages batch failed (${batches[b].join(', ')}):`, result.reason);
			failed.push(...batches[b]);
			return;
		}
		for (const node of Object.values(result.value)) {
			if (!node) continue;
			byRepo.set(node.name, {
				media: pickMedia(node),
				languages: (node.languages?.edges ?? []).map((e) => ({ name: e.node.name, bytes: e.size }))
			});
		}
	});
	return { byRepo, failed };
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

/**
 * One full refresh. `previous` is the last good entry: anything the GraphQL side fails to fetch
 * this time (a batch's media and languages, or the activity strip) is carried over from it, and
 * the entry then expires after DEGRADED_TTL_MS so the gap is retried soon.
 */
async function load(previous: CacheEntry | null): Promise<CacheEntry> {
	const apiUrl = `https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=updated`;

	// Started alongside the repo list; a failure is reported as undefined, distinct from the null
	// that means "no token".
	const activityP = loadActivity().catch((err) => {
		console.error('[github] activity lookup failed:', err);
		return undefined;
	});

	const res = await fetch(apiUrl, {
		headers: githubHeaders(),
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`GitHub API ${res.status}`);
	const raw = ((await res.json()) as RepoApiPayload[]).filter((r) => !r.fork);

	const [extras, fetchedActivity] = await Promise.all([
		loadExtras(raw.map((r) => r.name)),
		activityP
	]);
	const before = new Map(previous?.repos.map((r) => [r.name, r]));

	const repos: Repo[] = raw.map((r) => {
		const found = extras.byRepo.get(r.name) ?? before.get(r.name);
		return {
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
			media: found?.media ?? null,
			languages: found?.languages ?? []
		};
	});

	repos.sort((a, b) => {
		if (b.stars !== a.stars) return b.stars - a.stars;
		return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
	});

	const degraded = extras.failed.length > 0 || fetchedActivity === undefined;
	const now = Date.now();
	return {
		repos,
		fetchedAt: now,
		expiresAt: now + (degraded ? DEGRADED_TTL_MS : TTL_MS),
		activity: fetchedActivity === undefined ? (previous?.activity ?? null) : fetchedActivity
	};
}

function refresh(): Promise<CacheEntry> {
	inflight ??= load(cache)
		.then((entry) => {
			cache = entry;
			lastError = null;
			return entry;
		})
		.catch((err: unknown) => {
			const message = err instanceof Error ? err.message : 'Failed to load repos';
			lastError = { at: Date.now(), message };
			console.error('[github] refresh failed:', message);
			throw err;
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/**
 * Stale-while-revalidate: once anything is cached, every request is answered from the cache at
 * once and an expired entry is refreshed in the background. A GitHub round trip takes seconds, and
 * no visitor (or crawler) should wait on it. Only the very first request after boot does.
 */
export async function fetchRepos(): Promise<CacheEntry & { error?: string }> {
	const now = Date.now();

	if (cache) {
		const backingOff = lastError !== null && now - lastError.at < ERROR_BACKOFF_MS;
		if (now >= cache.expiresAt && !backingOff) refresh().catch(() => {});
		return lastError ? { ...cache, error: lastError.message } : cache;
	}

	try {
		return await refresh();
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load repos';
		return { repos: [], fetchedAt: now, expiresAt: now, activity: null, error: message };
	}
}
