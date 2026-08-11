import { env } from '$env/dynamic/private';
import type { Repo, RepoMedia } from './github';

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
	if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
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
	fork: boolean;
};

type CacheEntry = { repos: Repo[]; fetchedAt: number };
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

// One GraphQL request returns the root and docs/ trees for every repo at once, which keeps
// screenshot detection at a flat 1 API call instead of 1-2 per repo. GraphQL requires a token,
// so without one we skip detection entirely rather than spend the 60/hr anonymous REST budget.
const SCREENSHOT_QUERY = `query($login: String!) {
	user(login: $login) {
		repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
			nodes {
				name
				root: object(expression: "HEAD:") { ... on Tree { entries { name type } } }
				docs: object(expression: "HEAD:docs") { ... on Tree { entries { name type } } }
			}
		}
	}
}`;

type TreeEntry = { name: string; type: string };
type ScreenshotPayload = {
	data?: {
		user?: {
			repositories?: {
				nodes?: { name: string; root: { entries?: TreeEntry[] } | null; docs: { entries?: TreeEntry[] } | null }[];
			};
		};
	};
	errors?: { message: string }[];
};

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

async function loadScreenshots(): Promise<Map<string, RepoMedia>> {
	const found = new Map<string, RepoMedia>();
	if (!env.GITHUB_TOKEN) return found;

	const res = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
		body: JSON.stringify({ query: SCREENSHOT_QUERY, variables: { login: USER } })
	});
	if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);

	const body = (await res.json()) as ScreenshotPayload;
	if (body.errors?.length) throw new Error(body.errors[0].message);

	for (const node of body.data?.user?.repositories?.nodes ?? []) {
		const candidates = [
			...(node.docs?.entries ?? []).map((e) => candidate(e, 'docs')),
			...(node.root?.entries ?? []).map((e) => candidate(e, ''))
		].filter((c): c is Candidate => c !== null);

		if (!candidates.length) continue;

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
		found.set(node.name, {
			video: video ? `https://cdn.jsdelivr.net/gh/${USER}/${node.name}@HEAD/${video.path}` : null,
			image: image
				? `https://raw.githubusercontent.com/${USER}/${node.name}/HEAD/${image.path}`
				: null
		});
	}
	return found;
}

async function load(): Promise<CacheEntry> {
	const apiUrl = `https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=updated`;

	// A screenshot lookup that fails must never take the page down with it.
	const [res, screenshots] = await Promise.all([
		fetch(apiUrl, { headers: githubHeaders() }),
		loadScreenshots().catch(() => new Map<string, RepoMedia>())
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
			media: screenshots.get(r.name) ?? null
		}));

	repos.sort((a, b) => {
		if (b.stars !== a.stars) return b.stars - a.stars;
		return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
	});

	return { repos, fetchedAt: Date.now() };
}

export async function fetchRepos(): Promise<{ repos: Repo[]; fetchedAt: number; error?: string }> {
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
		return { repos: [], fetchedAt: now, error: message };
	}
}
