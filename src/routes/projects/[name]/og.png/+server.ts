import { findProject } from '#lib/project.server.js';
import { renderProjectOg } from '#lib/og.server.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const repo = await findProject(params.name, '/og.png');
	const png = await renderProjectOg(repo);

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
