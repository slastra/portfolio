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
