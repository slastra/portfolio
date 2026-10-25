import { marked } from 'marked';
import markedShiki from 'marked-shiki';
import { createHighlighter, type Highlighter } from 'shiki';
import DOMPurify from 'isomorphic-dompurify';
import { ATTACHMENT_LINE, githubHeaders } from './github.server';
import type { Repo } from './github';

const USER = 'slastra';
const TTL_MS = 30 * 60 * 1000;

export type Readme = {
	html: string;
	/** Prose only (no code, no headings), for meta descriptions when the repo has none. */
	text: string;
};

// Keyed by name, holding the pushed_at it was rendered from: a push invalidates the entry as soon
// as fetchRepos() picks it up, rather than waiting out the TTL, and old renders don't pile up.
type ReadmeEntry = Readme & { pushedAt: string; fetchedAt: number };
const cache = new Map<string, ReadmeEntry>();

let highlighterPromise: Promise<Highlighter> | null = null;
function getHighlighter(): Promise<Highlighter> {
	highlighterPromise ??= createHighlighter({
		themes: ['rose-pine'],
		langs: [
			'typescript',
			'javascript',
			'tsx',
			'jsx',
			'svelte',
			'vue',
			'html',
			'css',
			'json',
			'rust',
			'go',
			'zig',
			'python',
			'c',
			'cpp',
			'bash',
			'shell',
			'toml',
			'yaml',
			'markdown',
			'sql',
			'lua',
			'ruby',
			'java',
			'swift',
			'kotlin',
			'nix',
			'dockerfile'
		]
	});
	return highlighterPromise;
}

const renderer = marked.use(
	markedShiki({
		async highlight(code, lang) {
			const highlighter = await getHighlighter();
			const langs = highlighter.getLoadedLanguages();
			const safeLang = lang && langs.includes(lang as never) ? lang : 'text';
			return highlighter.codeToHtml(code, {
				lang: safeLang,
				theme: 'rose-pine'
			});
		}
	})
);
renderer.setOptions({ gfm: true });

// READMEs are written against the repo, so `demo.gif` or `docs/setup.md` mean files in it. Served
// from here they would resolve against dev.lastra.us and 404. Done as a sanitizer hook rather than
// a marked extension so it also catches raw HTML (`<img src="...">` is common in READMEs).
let currentRepo: string | null = null;
const ABSOLUTE = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

function resolveRelative(value: string, base: string): string {
	if (!value || ABSOLUTE.test(value)) return value;
	// A leading slash means the repo root on GitHub, not the host root.
	return new URL(value.replace(/^\/+/, ''), base).href;
}

// GitHub's heading slugs (github-slugger), so a README's own table of contents and #section links
// land: lowercase, drop punctuation, spaces to hyphens, repeats suffixed -1, -2, ...
const usedSlugs = new Map<string, number>();

function slugify(text: string): string {
	const base = text
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
		.replace(/ /g, '-');
	const seen = usedSlugs.get(base);
	usedSlugs.set(base, (seen ?? -1) + 1);
	return seen === undefined ? base : `${base}-${seen + 1}`;
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if (!currentRepo) return;

	if (/^H[1-6]$/.test(node.nodeName) && !node.querySelector('a.heading-anchor')) {
		const slug = slugify(node.textContent ?? '');
		if (slug) {
			node.setAttribute('id', slug);
			const anchor = node.ownerDocument.createElement('a');
			anchor.setAttribute('class', 'heading-anchor');
			anchor.setAttribute('href', `#${slug}`);
			anchor.setAttribute('aria-hidden', 'true');
			anchor.textContent = '#';
			node.prepend(anchor);
		}
	}

	const src = node.getAttribute('src');
	if (src) {
		node.setAttribute(
			'src',
			resolveRelative(src, `https://raw.githubusercontent.com/${USER}/${currentRepo}/HEAD/`)
		);
	}
	const href = node.getAttribute('href');
	if (href) {
		node.setAttribute(
			'href',
			resolveRelative(href, `https://github.com/${USER}/${currentRepo}/blob/HEAD/`)
		);
	}
});

// sanitize() is synchronous, so the per-document state can't leak between concurrent renders.
function sanitize(html: string, repo: string): string {
	currentRepo = repo;
	usedSlugs.clear();
	try {
		return DOMPurify.sanitize(html);
	} finally {
		currentRepo = null;
	}
}

const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&#x27;': "'",
	'&nbsp;': ' '
};

function plainText(html: string): string {
	return html
		.replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
		.replace(/<h[1-6][\s\S]*?<\/h[1-6]>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (e) => ENTITIES[e])
		.replace(/\s+/g, ' ')
		.trim();
}

// Most READMEs carry `# <repo name>` as their title, which the project page and the modal already
// print as their own heading. Dropping the repeat also leaves the project page with a single h1.
// It isn't always the first line (tabctl leads with its demo video) or spelled like the repo
// ("DP100 Studio" for dp100-studio), so the first h1 outside code fences is compared on letters
// and digits alone. A title that says something more ("# lastshell: a Quickshell shell") stays.
function dropTitle(markdown: string, name: string): string {
	const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
	const lines = markdown.split('\n');
	let fence: string | null = null;
	for (let i = 0; i < lines.length; i++) {
		const opener = /^\s*(`{3,}|~{3,})/.exec(lines[i])?.[1];
		if (opener && (!fence || opener.startsWith(fence))) {
			fence = fence ? null : opener;
			continue;
		}
		if (fence) continue;
		const title = /^#[ \t]+(.+?)[ \t]*#*[ \t]*\r?$/.exec(lines[i])?.[1];
		if (title === undefined) continue;
		if (bare(title) === bare(name)) lines.splice(i, 1);
		break;
	}
	return lines.join('\n');
}

// GitHub turns a bare user-attachments link on its own line into a player; marked would leave it a
// plain URL. tabctl's demo is one of these, and with no separate banner on its page it would
// otherwise be the only way to see it.
function embedAttachments(markdown: string): string {
	return markdown.replace(
		ATTACHMENT_LINE,
		'<video src="$1" controls muted playsinline preload="metadata"></video>'
	);
}

/** Rendered, sanitised README for a repo; `{ html: '', text: '' }` when it has none. */
export async function getReadme(repo: Repo): Promise<Readme> {
	const cached = cache.get(repo.name);
	if (
		cached &&
		cached.pushedAt === repo.pushed_at &&
		Date.now() - cached.fetchedAt < TTL_MS
	) {
		return cached;
	}

	const res = await fetch(`https://api.github.com/repos/${USER}/${repo.name}/readme`, {
		headers: { ...githubHeaders(), Accept: 'application/vnd.github.raw' }
	});

	let readme: Readme;
	if (res.status === 404) {
		readme = { html: '', text: '' };
	} else if (!res.ok) {
		throw new Error(`GitHub API ${res.status}`);
	} else {
		const markdown = embedAttachments(dropTitle(await res.text(), repo.name));
		const rendered = await renderer.parse(markdown, { async: true });
		const html = sanitize(rendered, repo.name);
		readme = { html, text: plainText(html) };
	}

	cache.set(repo.name, { ...readme, pushedAt: repo.pushed_at, fetchedAt: Date.now() });
	return readme;
}
