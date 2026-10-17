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
	created_at: string;
	topics: string[];
	/** SPDX id, or null when GitHub couldn't identify one. */
	license: string | null;
	/** Card banner pulled from the repo, or null when it has neither a screenshot nor a demo. */
	media: RepoMedia | null;
};

/**
 * Both are kept rather than picking one server-side: whether a video is actually playable
 * depends on its codec, which the file tree can't tell us (hyprglaze's demo.mp4 is HEVC, which
 * Chrome won't decode on Linux). The card prefers the video and falls back to the image if the
 * browser refuses it.
 */
export type RepoMedia = {
	video: string | null;
	image: string | null;
};

type Accent = 'rose' | 'love' | 'gold' | 'pine' | 'foam' | 'iris';

// Rosé Pine's dark-variant hex values, for contexts that can't resolve the CSS variables (the
// satori-rendered OG images, which also don't understand oklch).
export const accentHex: Record<Accent, string> = {
	rose: '#ebbcba',
	love: '#eb6f92',
	gold: '#f6c177',
	pine: '#31748f',
	foam: '#9ccfd8',
	iris: '#c4a7e7'
};

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

/** Hex accent for a language, or Rosé Pine's muted grey when it has none. */
export function languageHex(lang: string | null): string {
	const accent = lang ? languageAccent[lang] : undefined;
	return accent ? accentHex[accent] : '#6e6a86';
}

export function languageColor(lang: string | null): string {
	if (!lang) return 'var(--muted-foreground)';
	const accent = languageAccent[lang];
	return accent ? `var(--${accent})` : 'var(--muted-foreground)';
}
