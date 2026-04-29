import { error, json } from '@sveltejs/kit';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { fetchRepos } from '$lib/github';
import type { RequestHandler } from './$types';

type ReadmeEntry = { html: string; fetchedAt: number };
const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, ReadmeEntry>();

marked.setOptions({ gfm: true });

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
		headers: {
			Accept: 'application/vnd.github.raw',
			'User-Agent': 'dev.lastra.us'
		}
	});

	if (res.status === 404) return json({ html: '' });
	if (!res.ok) throw error(502, `GitHub API ${res.status}`);

	const md = await res.text();
	const rendered = await marked.parse(md);
	const html = DOMPurify.sanitize(rendered);

	cache.set(name, { html, fetchedAt: Date.now() });
	return json({ html });
};
