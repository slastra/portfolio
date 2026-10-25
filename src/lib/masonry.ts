import type { Attachment } from 'svelte/attachments';

/** The empty stretch at the foot of one column, in px from the grid's top-left corner. */
export type Gap = { left: number; top: number; width: number; height: number };

/**
 * Every column's gap, plus the grid's own size, which the page sizes the hatch to. Reported from
 * here rather than read with bind:clientWidth/Height: those are a ResizeObserver on an element as
 * tall as the grid, which every span set below resizes in the same frame, a "ResizeObserver loop".
 */
export type Gaps = { gaps: Gap[]; width: number; height: number };

/**
 * Row-major masonry over an ordinary CSS grid. CSS columns would pack the cards without script,
 * but they fill top to bottom, so the top row read 01, 09, 18, 27 and the strongest projects were
 * stacked down the left edge. Native masonry (display: grid-lanes) isn't in Chrome yet.
 *
 * The server renders a plain grid that already reads left to right; it only leaves gaps under the
 * shorter cards. Once this runs, the rows collapse to 1px and each child spans as many as it is
 * tall, so grid auto-placement drops every card into the column that frees up first. The top row
 * never moves, which keeps the shift on hydration below the fold.
 *
 * Columns still end at different heights. `ongaps`, if given, hears where after every layout
 * change, so the page can fill the space under the shorter ones.
 */
export function masonry(ongaps?: (layout: Gaps) => void): Attachment<HTMLElement> {
	return (grid) => {
		// Read before masonry mode zeroes row-gap; the column gap is the same token. The ruled index
		// grid has no gap at all (cells draw their own hairlines), so there it's 0 and a span is just
		// the cell's height.
		const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;

		const span = (el: Element, height: number) => {
			(el as HTMLElement).style.gridRowEnd = `span ${Math.ceil(height + gap)}`;
		};

		// Measured a frame after the spans change, once the grid has placed everything.
		let frame = 0;
		const reportGaps = () => {
			if (!ongaps || frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				ongaps(measureGaps(grid));
			});
		};

		// Card heights move after hydration (web fonts, the readme spinner, a banner that fails and
		// drops out), so each child is observed rather than measured once.
		const sizes = new ResizeObserver((entries) => {
			for (const entry of entries) span(entry.target, entry.borderBoxSize[0].blockSize);
			reportGaps();
		});

		// Filtering adds and removes children under the same grid.
		const children = new MutationObserver((records) => {
			for (const record of records) {
				for (const node of record.addedNodes) if (node instanceof HTMLElement) sizes.observe(node);
				for (const node of record.removedNodes) if (node instanceof HTMLElement) sizes.unobserve(node);
			}
			reportGaps();
		});

		for (const child of grid.children) sizes.observe(child);
		children.observe(grid, { childList: true });
		// A column only comes or goes with the window's width. Not a ResizeObserver on the grid:
		// every span set above changes the grid's height in the same frame, which the browser
		// refuses to re-deliver and reports as a "ResizeObserver loop" error.
		addEventListener('resize', reportGaps);
		grid.dataset.masonry = '';

		return () => {
			cancelAnimationFrame(frame);
			removeEventListener('resize', reportGaps);
			sizes.disconnect();
			children.disconnect();
			delete grid.dataset.masonry;
			for (const child of grid.children) (child as HTMLElement).style.gridRowEnd = '';
			ongaps?.({ gaps: [], width: 0, height: 0 });
		};
	};
}

/**
 * Where each column's last cell ends, against the bottom of the tallest one. Cells are located by
 * their rendered boxes rather than their grid placement, which auto-placement doesn't expose; a
 * cell that spans two columns (the intro tile) counts for both.
 */
function measureGaps(grid: HTMLElement): Gaps {
	const box = grid.getBoundingClientRect();
	const tracks = getComputedStyle(grid).gridTemplateColumns.split(' ').map(parseFloat);
	// One column has nothing beside it to fall short of.
	if (tracks.length < 2) return { gaps: [], width: box.width, height: box.height };

	const starts: number[] = [];
	tracks.reduce((x, width) => (starts.push(x), x + width), 0);

	const bottoms = tracks.map(() => 0);
	for (const child of grid.children) {
		const r = child.getBoundingClientRect();
		if (!r.height) continue;
		// Cells sit 1px left of their track so their rules overlap; round that away.
		const left = Math.round(r.left - box.left);
		const right = Math.round(r.right - box.left);
		starts.forEach((start, i) => {
			if (start + tracks[i] / 2 > left && start + tracks[i] / 2 < right) {
				bottoms[i] = Math.max(bottoms[i], r.bottom - box.top);
			}
		});
	}

	const floor = Math.max(...bottoms);
	const gaps = starts
		.map((left, i) => ({ left, width: tracks[i], top: bottoms[i], height: floor - bottoms[i] }))
		.filter((g) => g.height >= 1);
	return { gaps, width: box.width, height: box.height };
}
