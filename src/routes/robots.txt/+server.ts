import { SITE_URL } from '$lib/seo';
import type { RequestHandler } from './$types';

export const prerender = true;

// /og and /static-preview are render scratch pages; /api is JSON. None should compete with the
// index for the name query.
const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /og
Disallow: /static-preview

Sitemap: ${SITE_URL}/sitemap.xml
`;

export const GET: RequestHandler = () =>
	new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
