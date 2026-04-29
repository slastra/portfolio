import { error, json } from '@sveltejs/kit';
import { marked } from 'marked';
import markedShiki from 'marked-shiki';
import { createHighlighter, type Highlighter } from 'shiki';
import DOMPurify from 'isomorphic-dompurify';
import { fetchRepos, githubHeaders } from '$lib/github';
import type { RequestHandler } from './$types';

type ReadmeEntry = { html: string; fetchedAt: number };
const TTL_MS = 30 * 60 * 1000;
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

export const GET: RequestHandler = async ({ params }) => {
	const name = params.name;
	if (!name || !/^[\w.-]+$/.test(name)) throw error(400, 'invalid repo name');

	const { repos } = await fetchRepos();
	if (!repos.some((r) => r.name === name)) throw error(404, 'unknown repo');

	const cached = cache.get(name);
	if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
		return json({ html: cached.html });
	}

	const res = await fetch(`https://api.github.com/repos/slastra/${name}/readme`, {
		headers: { ...githubHeaders(), Accept: 'application/vnd.github.raw' }
	});

	if (res.status === 404) return json({ html: '' });
	if (!res.ok) throw error(502, `GitHub API ${res.status}`);

	const md = await res.text();
	const rendered = await renderer.parse(md, { async: true });
	const html = DOMPurify.sanitize(rendered);

	cache.set(name, { html, fetchedAt: Date.now() });
	return json({ html });
};
