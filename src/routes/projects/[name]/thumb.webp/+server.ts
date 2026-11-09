import { error, redirect } from '@sveltejs/kit';
import { findProject } from '#lib/project.server.js';
import { thumbVersion } from '#lib/seo.js';
import { getThumb, isThumbWidth, type Thumb } from '#lib/thumb.server.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, request }) => {
	const repo = await findProject(params.name, `/thumb.webp${url.search}`);
	const source = repo.media?.image;
	if (!source) error(404, 'No banner image');

	const width = Number(url.searchParams.get('w'));
	if (!isThumbWidth(width)) error(400, 'Unsupported width');

	const version = thumbVersion(repo);
	let thumb: Thumb;
	try {
		thumb = await getThumb(source, width);
	} catch (err) {
		// The card still gets a picture: the original, just not resized.
		console.error(`[thumb] ${repo.name} at ${width}px failed:`, err);
		redirect(302, source);
	}

	// v is the repo's last push, so a URL naming the current one can be kept for a while; a push
	// that changes the banner changes the URL. Not immutable: a README image hosted elsewhere
	// (lastshell shows dots' demo.gif) can change without this repo being pushed, so a week.
	// An old v (a page rendered before the last push) answers with the new image, briefly.
	const cacheControl =
		url.searchParams.get('v') === version ? 'public, max-age=604800' : 'public, max-age=600';

	if (request.headers.get('if-none-match') === thumb.etag) {
		return new Response(null, { status: 304, headers: { ETag: thumb.etag, 'Cache-Control': cacheControl } });
	}

	return new Response(thumb.body, {
		headers: {
			'Content-Type': 'image/webp',
			'Content-Length': String(thumb.body.byteLength),
			ETag: thumb.etag,
			'Cache-Control': cacheControl
		}
	});
};
