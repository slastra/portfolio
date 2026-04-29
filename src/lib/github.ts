import { env } from '$env/dynamic/private';

export function githubHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'User-Agent': 'dev.lastra.us'
	};
	if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
	return headers;
}

export type Repo = {
	name: string;
	description: string | null;
	html_url: string;
	homepage: string | null;
	language: string | null;
	stars: number;
	forks: number;
	archived: boolean;
	pushed_at: string;
};

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

const USER = 'slastra';
const TTL_MS = 10 * 60 * 1000;

type Accent = 'rose' | 'love' | 'gold' | 'pine' | 'foam' | 'iris';

const languageAccent: Record<string, Accent> = {
	TypeScript: 'foam',
	JavaScript: 'gold',
	Rust: 'rose',
	Go: 'pine',
	Zig: 'gold',
	Vue: 'pine',
	Svelte: 'love',
	Python: 'iris',
	C: 'foam',
	'C++': 'love',
	Shell: 'foam',
	HTML: 'love',
	CSS: 'iris',
	Lua: 'iris',
	Ruby: 'love',
	Java: 'gold',
	Swift: 'rose',
	Kotlin: 'iris',
	Nix: 'foam'
};

export function languageColor(lang: string | null): string {
	if (!lang) return 'var(--muted-foreground)';
	const accent = languageAccent[lang];
	return accent ? `var(--${accent})` : 'var(--muted-foreground)';
}

type CacheEntry = { repos: Repo[]; fetchedAt: number };
let cache: CacheEntry | null = null;
let lastError: { at: number; message: string } | null = null;
let inflight: Promise<CacheEntry> | null = null;

// Refetch sooner than TTL when the previous attempt errored, so a transient failure
// (rate-limit, network blip) doesn't pin stale data for the full TTL window.
const ERROR_BACKOFF_MS = 30 * 1000;

async function load(): Promise<CacheEntry> {
	const apiUrl = `https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=updated`;
	const res = await fetch(apiUrl, { headers: githubHeaders() });
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
			pushed_at: r.pushed_at
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
