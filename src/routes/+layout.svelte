<script lang="ts">
	import '@fontsource-variable/playfair-display';
	// Static cuts, not variable: neither family has a variable build on fontsource. Only the
	// weights the site sets; anything else would be synthesized from these.
	import '@fontsource/spectral/400.css';
	import '@fontsource/spectral/400-italic.css';
	import '@fontsource/spectral/600.css';
	import '@fontsource/spectral/700.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	import '@fontsource/ibm-plex-mono/600.css';
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="dark" />

<div class="relative min-h-screen">
	<div class="mesh" aria-hidden="true">
		<span class="track rise"><span class="wash rose"></span></span>
		<span class="track sink"><span class="wash iris"></span></span>
		<span class="track lift"><span class="wash foam"></span></span>
		<span class="track lift-far"><span class="wash pine"></span></span>
	</div>

	{@render children()}
</div>

<style>
	/* A mesh gradient: soft radial washes in the Rosé Pine accents, each fading out by its own
	   radius, so where they meet they blend instead of banding into rings. Kept faint: the page
	   should read as the base colour with a hint of light at the edges.

	   Each wash is its own layer drifting on its own path and period, so the colour field slowly
	   reshapes as they pass one another instead of the whole sheet swaying as one. They animate
	   transform only, which stays on the compositor: no repaint per frame.

	   Fixed to the viewport, so the field sits behind the grid at any scroll depth, and plain
	   gradients rather than blur(120px), which the browser had to filter on every paint. The
	   body's grain tile shows through from below. */
	.mesh {
		position: fixed;
		inset: 0;
		z-index: -10;
		overflow: hidden;
		pointer-events: none;
	}

	/* Scroll response. Each wash sits in a track that moves with the page's scroll position
	   (a scroll-driven animation, so no scroll listener and no main-thread work), while the
	   wash inside keeps its own drift; the two transforms compose instead of fighting over one.
	   Scrolling down, the top washes slide away and the bottom ones rise, so the colour migrates
	   down the page with the reader. Browsers without scroll timelines keep the drift alone:
	   unguarded, the duration-less animation would sit at its end state. */
	.track {
		position: absolute;
		inset: 0;
	}
	@supports (animation-timeline: scroll()) {
		.track {
			animation: var(--scroll-path) linear both;
			animation-timeline: scroll(root block);
		}
		.rise {
			--scroll-path: mesh-scroll-rise;
		}
		.sink {
			--scroll-path: mesh-scroll-sink;
		}
		.lift {
			--scroll-path: mesh-scroll-lift;
		}
		.lift-far {
			--scroll-path: mesh-scroll-lift-far;
		}
	}

	.wash {
		position: absolute;
		width: 70vmax;
		height: 70vmax;
		background: radial-gradient(
			closest-side,
			color-mix(in oklch, var(--wash) calc(var(--strength) * var(--mesh)), transparent),
			transparent
		);
		animation: var(--path) var(--period) ease-in-out infinite alternate;
	}

	/* Anchored around the edges so the middle of the page stays the plain base. */
	.rose {
		--wash: var(--rose);
		--strength: 22%;
		--path: mesh-drift-a;
		--period: 26s;
		left: -25vmax;
		top: -30vmax;
	}
	.iris {
		--wash: var(--iris);
		--strength: 20%;
		--path: mesh-drift-b;
		--period: 34s;
		right: -28vmax;
		top: -26vmax;
	}
	.foam {
		--wash: var(--foam);
		--strength: 14%;
		--path: mesh-drift-c;
		--period: 30s;
		left: -30vmax;
		bottom: -32vmax;
	}
	.pine {
		--wash: var(--pine);
		--strength: 24%;
		--path: mesh-drift-a;
		--period: 38s;
		right: -24vmax;
		bottom: -30vmax;
		animation-direction: alternate-reverse;
	}

	/* Global names: each wash picks its path through a custom property, which Svelte can't follow
	   to rewrite a scoped keyframes name. */
	@keyframes -global-mesh-drift-a {
		from {
			transform: translate3d(0, 0, 0) scale(1);
		}
		to {
			transform: translate3d(14vmax, 10vmax, 0) scale(1.15);
		}
	}
	@keyframes -global-mesh-drift-b {
		from {
			transform: translate3d(0, 0, 0) scale(1.1);
		}
		to {
			transform: translate3d(-16vmax, 12vmax, 0) scale(0.95);
		}
	}
	@keyframes -global-mesh-drift-c {
		from {
			transform: translate3d(0, 0, 0) scale(0.95);
		}
		to {
			transform: translate3d(12vmax, -14vmax, 0) scale(1.12);
		}
	}

	@keyframes -global-mesh-scroll-rise {
		to {
			transform: translate3d(8vw, -35vh, 0);
		}
	}
	@keyframes -global-mesh-scroll-sink {
		to {
			transform: translate3d(-10vw, 45vh, 0);
		}
	}
	@keyframes -global-mesh-scroll-lift {
		to {
			transform: translate3d(6vw, -40vh, 0);
		}
	}
	@keyframes -global-mesh-scroll-lift-far {
		to {
			transform: translate3d(-12vw, -55vh, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.wash,
		.track {
			animation: none;
		}
	}
</style>
