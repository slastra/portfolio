import { read } from '$app/server';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
// Static weights rather than the variable fonts the site loads: satori can't apply a variable
// axis, and it reads woff but not woff2. Imported as assets so they ship inside the build.
import playfair900 from '@fontsource/playfair-display/files/playfair-display-latin-900-normal.woff';
import playfairItalic400 from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff';
import spectral400 from '@fontsource/spectral/files/spectral-latin-400-normal.woff';
import plexMono500 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff';
import { accentHex, languageHex, type Repo } from './github';

const WIDTH = 1200;
const HEIGHT = 630;

// Rosé Pine (dark). satori understands neither oklch nor the CSS variables, so these are the
// hex originals of the tokens in app.css.
const BASE = '#191724';
const TEXT = '#e0def4';
const SUBTLE = '#908caa';
const MUTED = '#6e6a86';
const OVERLAY = '#26233a';

type Style = Record<string, string | number>;
type Child = Node | string | null | false;
type Node = { type: string; props: { style?: Style; children?: Child | Child[] } };

/** satori takes React-shaped element objects; this is the whole of the JSX we need. */
function h(type: string, style: Style, children?: Child | Child[]): Node {
	return { type, props: { style, children } };
}

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 900; style: 'normal' | 'italic' };
let fontsPromise: Promise<Font[]> | null = null;

function loadFonts(): Promise<Font[]> {
	const load = (asset: string) => read(asset).arrayBuffer();
	fontsPromise ??= Promise.all([
		load(playfair900),
		load(playfairItalic400),
		load(spectral400),
		load(plexMono500)
	]).then(([display, displayItalic, serif, mono]) => [
		{ name: 'Playfair Display', data: display, weight: 900, style: 'normal' },
		{ name: 'Playfair Display', data: displayItalic, weight: 400, style: 'italic' },
		{ name: 'Spectral', data: serif, weight: 400, style: 'normal' },
		{ name: 'IBM Plex Mono', data: mono, weight: 500, style: 'normal' }
	]);
	return fontsPromise;
}

/** Long names step down so they stay on one or two lines instead of overrunning the frame. */
function titleSize(name: string): number {
	if (name.length <= 10) return 150;
	if (name.length <= 16) return 118;
	if (name.length <= 24) return 92;
	return 72;
}

function blob(left: string, top: string, size: number, color: string): Node {
	return h('div', {
		position: 'absolute',
		left,
		top,
		width: size,
		height: size,
		backgroundImage: `radial-gradient(circle at center, ${color} 0%, transparent 70%)`
	});
}

const mono = (color: string): Style => ({
	fontFamily: 'IBM Plex Mono',
	fontSize: 20,
	letterSpacing: 4,
	textTransform: 'uppercase',
	color
});

function card(repo: Repo): Node {
	const lang = repo.language ? languageHex(repo.language) : null;
	const facts: Child[] = [];
	if (repo.language && lang) {
		facts.push(
			h('div', { display: 'flex', alignItems: 'center', gap: 12 }, [
				h('div', { width: 16, height: 16, borderRadius: 8, backgroundColor: lang }),
				h('div', { ...mono(TEXT), textTransform: 'none', letterSpacing: 1 }, repo.language)
			])
		);
	}
	if (repo.stars > 0) {
		facts.push(h('div', mono(SUBTLE), `${repo.stars} ${repo.stars === 1 ? 'star' : 'stars'}`));
	}
	if (repo.archived) facts.push(h('div', mono(SUBTLE), 'archived'));
	// Budgeted by length rather than count: three short topics fit where one long one barely does,
	// and the row must stay on one line or it pushes itself out of the frame.
	let budget = 60 - (repo.language?.length ?? 0) - (repo.stars > 0 ? 10 : 0);
	for (const topic of repo.topics) {
		budget -= topic.length + 4;
		if (budget < 0) break;
		facts.push(
			h(
				'div',
				{
					...mono(SUBTLE),
					fontSize: 17,
					letterSpacing: 1,
					textTransform: 'none',
					padding: '4px 14px',
					borderRadius: 999,
					border: `1px solid ${OVERLAY}`
				},
				topic
			)
		);
	}

	return h(
		'div',
		{
			position: 'relative',
			display: 'flex',
			width: WIDTH,
			height: HEIGHT,
			backgroundColor: BASE,
			overflow: 'hidden'
		},
		[
			blob('-260px', '-380px', 900, 'rgba(235, 188, 186, 0.16)'),
			blob('700px', '200px', 820, 'rgba(196, 167, 231, 0.13)'),
			blob('420px', '-160px', 520, 'rgba(156, 207, 216, 0.08)'),
			h(
				'div',
				{
					// Inset rather than padding: satori adds padding on top of an explicit height,
					// which pushed the bottom row out of the frame.
					position: 'absolute',
					top: 72,
					bottom: 72,
					left: 88,
					right: 88,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between'
				},
				[
					h('div', { display: 'flex', ...mono(MUTED), fontSize: 18, letterSpacing: 7 }, [
						'dev',
						h('span', { color: accentHex.rose }, '.'),
						'lastra.us · projects'
					]),
					h('div', { display: 'flex', flexDirection: 'column', gap: 24 }, [
						h(
							'div',
							{
								fontFamily: 'Playfair Display',
								fontWeight: 900,
								fontSize: titleSize(repo.name),
								lineHeight: 0.95,
								letterSpacing: -2,
								color: TEXT
							},
							repo.name
						),
						repo.description
							? h(
									'div',
									{
										display: 'block',
										lineClamp: 3,
										fontFamily: 'Spectral',
										fontSize: 34,
										lineHeight: 1.3,
										color: SUBTLE,
										maxWidth: 980
									},
									repo.description
								)
							: null
					]),
					h('div', { display: 'flex', alignItems: 'center', gap: 22, overflow: 'hidden' }, facts)
				]
			)
		]
	);
}

// Keyed by name with the pushed_at it was drawn from, like the readme cache: a push redraws it,
// an unchanged repo is never rendered twice.
const cache = new Map<string, { pushedAt: string; png: Uint8Array<ArrayBuffer> }>();

/** 1200×630 PNG preview card for a project, in the site's palette. */
export async function renderProjectOg(repo: Repo): Promise<Uint8Array<ArrayBuffer>> {
	const cached = cache.get(repo.name);
	if (cached?.pushedAt === repo.pushed_at) return cached.png;

	const svg = await satori(card(repo), { width: WIDTH, height: HEIGHT, fonts: await loadFonts() });
	// Copied out of resvg's Buffer, whose backing store may be a SharedArrayBuffer as far as the
	// types know, which Response won't accept as a body.
	const png = new Uint8Array(new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng());

	cache.set(repo.name, { pushedAt: repo.pushed_at, png });
	return png;
}
