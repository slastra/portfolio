import { fetchRepos } from '#lib/github.server.js';
import { projectUrl, SITE_URL } from '#lib/seo.js';
import type { RequestHandler } from './$types';

const escapeXml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The index's lastmod is the newest push across the repos, which is when its visible content last
// changed; each project page's is its own push. Screenshots ride along as image entries so they
// can surface in image search. fetchRepos() is cached, so this costs no extra calls.
export const GET: RequestHandler = async () => {
	const { repos, fetchedAt } = await fetchRepos();
	const newest = repos.reduce(
		(max, r) => Math.max(max, Date.parse(r.pushed_at) || 0),
		0
	);
	const lastmod = new Date(newest || fetchedAt).toISOString();

	const projects = repos
		.map((r) => {
			const image = r.media?.image
				? `\n    <image:image>\n      <image:loc>${escapeXml(r.media.image)}</image:loc>\n    </image:image>`
				: '';
			return `  <url>
    <loc>${escapeXml(projectUrl(r.name))}</loc>
    <lastmod>${new Date(r.pushed_at).toISOString()}</lastmod>${image}
  </url>`;
		})
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${projects}
</urlset>
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=600'
		}
	});
};
