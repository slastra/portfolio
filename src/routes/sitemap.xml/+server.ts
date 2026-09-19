import { fetchRepos } from '$lib/github.server';
import { SITE_URL } from '$lib/seo';
import type { RequestHandler } from './$types';

// Single-page site, so the sitemap's job is the lastmod: the newest push across the repos, which
// is when the visible content last changed. fetchRepos() is cached, so this costs no extra calls.
export const GET: RequestHandler = async () => {
	const { repos, fetchedAt } = await fetchRepos();
	const newest = repos.reduce(
		(max, r) => Math.max(max, Date.parse(r.pushed_at) || 0),
		0
	);
	const lastmod = new Date(newest || fetchedAt).toISOString();

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=600'
		}
	});
};
