import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { Repo } from './github';
import { THUMB_WIDTHS, type ThumbWidth } from './seo';

/**
 * Card-sized WebP renditions of each repo's banner image. The sources are whatever the repos
 * ship (a 1.3 MB PNG, a 7.4 MB GIF), drawn into a card a few hundred pixels wide, so the
 * resize is most of the page weight. Renders live in memory, keyed by source URL and width
 * (two repos can share one source: lastshell's README shows dots' demo.gif). They're served
 * stale-while-revalidate: past RECHECK_MS the source is re-requested with its ETag in the
 * background, and only a changed source is rendered again.
 */

const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20 * 1000;
const RECHECK_MS = 10 * 60 * 1000;
// Two widths for each banner'd repo, with headroom; least recently used goes first.
const MAX_ENTRIES = 100;

// Animated sources render at most this wide. A 7.4 MB GIF comes out at ~2 MB here and ~3.6 MB
// at 1280, and screen-recorded GIFs are soft enough that 2x buys nothing visible.
const ANIMATED_MAX_WIDTH: ThumbWidth = 640;

// The finished WebPs are cached here, so libvips' own operation cache only holds decoded
// sources we won't touch again. One thread: renders happen a few times an hour on a shared box.
sharp.cache(false);
sharp.concurrency(1);

export type Thumb = { body: Uint8Array<ArrayBuffer>; etag: string };
type Entry = { thumb: Thumb; sourceEtag: string | null; checkedAt: number };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();

export function isThumbWidth(n: number): n is ThumbWidth {
	return (THUMB_WIDTHS as readonly number[]).includes(n);
}

/** Fetches and renders `source`, or confirms `previous` is still current (an ETag 304). */
async function render(source: string, width: ThumbWidth, previous?: Entry): Promise<Entry> {
	const headers: Record<string, string> = {};
	if (previous?.sourceEtag) headers['If-None-Match'] = previous.sourceEtag;

	const res = await fetch(source, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (res.status === 304 && previous) return { ...previous, checkedAt: Date.now() };
	if (!res.ok) throw new Error(`source ${res.status}`);
	if (Number(res.headers.get('content-length')) > MAX_SOURCE_BYTES) {
		throw new Error('source too large');
	}
	const input = await res.arrayBuffer();
	if (input.byteLength > MAX_SOURCE_BYTES) throw new Error('source too large');

	// animated keeps every frame of a GIF rather than flattening it to the first.
	const image = sharp(input, { animated: true });
	const { pages = 1 } = await image.metadata();
	const out = await image
		.resize({ width: pages > 1 ? Math.min(width, ANIMATED_MAX_WIDTH) : width, withoutEnlargement: true })
		.webp({ quality: 72 })
		.toBuffer();

	const body = new Uint8Array(out);
	return {
		thumb: { body, etag: `"${createHash('sha1').update(body).digest('base64url').slice(0, 16)}"` },
		sourceEtag: res.headers.get('etag'),
		checkedAt: Date.now()
	};
}

function refresh(key: string, source: string, width: ThumbWidth, previous?: Entry): Promise<Entry> {
	let pending = inflight.get(key);
	if (!pending) {
		pending = render(source, width, previous)
			.then((entry) => {
				cache.delete(key);
				cache.set(key, entry);
				for (const oldest of cache.keys()) {
					if (cache.size <= MAX_ENTRIES) break;
					cache.delete(oldest);
				}
				return entry;
			})
			.finally(() => inflight.delete(key));
		inflight.set(key, pending);
	}
	return pending;
}

/** The rendition of `source` at `width`. Only the first request for a source waits on a render. */
export async function getThumb(source: string, width: ThumbWidth): Promise<Thumb> {
	const key = `${width}|${source}`;
	const hit = cache.get(key);
	if (!hit) return (await refresh(key, source, width)).thumb;

	// Re-insert so Map order tracks recency.
	cache.delete(key);
	cache.set(key, hit);
	if (Date.now() - hit.checkedAt >= RECHECK_MS) {
		refresh(key, source, width, hit).catch((err) =>
			console.error(`[thumb] recheck of ${source} failed, serving the old render:`, err)
		);
	}
	return hit.thumb;
}

let warming = false;

/**
 * Renders every card's thumbnails ahead of the first visitor. One at a time, since an animated
 * GIF takes seconds of CPU; a source that's already cached and fresh costs nothing.
 */
export async function warmThumbs(repos: Repo[]): Promise<void> {
	if (warming) return;
	warming = true;
	try {
		const sources = new Set(repos.map((r) => r.media?.image).filter((s): s is string => !!s));
		for (const source of sources) {
			for (const width of THUMB_WIDTHS) {
				await getThumb(source, width).catch((err) =>
					console.error(`[thumb] warm-up of ${source} at ${width}px failed:`, err)
				);
			}
		}
	} finally {
		warming = false;
	}
}
