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
	/** Every language GitHub measured in the repo, largest first. Empty without a token. */
	languages: LanguageShare[];
};

export type LanguageShare = { name: string; bytes: number };

/**
 * GitHub contributions over the last year, as the header's activity strip draws them: 52 rolling
 * 7-day windows ending today, oldest first. Rolling rather than calendar weeks so the newest bar
 * is always a full week; a calendar week that started this morning would read as a collapse.
 */
export type Activity = {
	total: number;
	weeks: { start: string; end: string; count: number }[];
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
	/**
	 * Taken from the README's first image or video rather than a screenshot.* / demo.* file. The
	 * README already opens with it, so the project page doesn't repeat it as a banner.
	 */
	fromReadme: boolean;
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

export type Segment = { name: string; value: number; color: string };

/**
 * A run of language bar segments, in the order given. Rosé Pine has six accents for far more
 * languages, so neighbours can share one (TypeScript and C are both foam, and sit side by side
 * when weighted by code). A segment that would touch a same-coloured neighbour is drawn in a
 * deeper shade of it, or the bar would read the two as one. `null` is the catch-all "other".
 */
export function segments(items: { name: string | null; value: number }[]): Segment[] {
	let previous = '';
	return items.map(({ name, value }) => {
		const base = languageColor(name);
		const color = base === previous ? `color-mix(in oklch, ${base} 55%, var(--background))` : base;
		// Compared on the base accent, so a third in a row goes back to full strength.
		previous = color === base ? base : '';
		return { name: name ?? 'other', value, color };
	});
}

/** Share of a repo's code by language, folding anything under `floor` into one "other". */
export function codeShares(languages: LanguageShare[], floor = 0.01): { name: string | null; value: number }[] {
	const total = languages.reduce((sum, l) => sum + l.bytes, 0);
	if (!total) return [];
	const kept = languages.filter((l) => l.bytes / total >= floor);
	const rest = total - kept.reduce((sum, l) => sum + l.bytes, 0);
	return [
		...kept.map((l) => ({ name: l.name, value: l.bytes / total })),
		...(rest > 0 ? [{ name: null, value: rest / total }] : [])
	];
}

/**
 * How the language strip weighs the index: by each project's primary language, or by bytes of
 * code across every project.
 */
export type LanguageView = 'projects' | 'code';

/**
 * Whether a repo belongs under a language in the given view. Weighed by projects that is its
 * primary language; weighed by code it is any language it contains, so Python, the primary
 * language of 5 projects, matches the 14 that use it.
 */
export function usesLanguage(repo: Repo, language: string, view: LanguageView): boolean {
	return view === 'code'
		? repo.languages.some((l) => l.name === language) || repo.language === language
		: repo.language === language;
}

/** "23%", or "<1%" for a sliver that rounds to nothing. */
export function percent(share: number): string {
	return share < 0.005 ? '<1%' : `${Math.round(share * 100)}%`;
}
