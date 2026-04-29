<script lang="ts">
	import '@fontsource-variable/playfair-display';
	import '@fontsource-variable/source-serif-4';
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="dark" />

<div class="relative min-h-screen">
	<svg
		class="absolute inset-0 pointer-events-none h-full w-full opacity-[0.15] -z-20"
		aria-hidden="true"
	>
		<filter id="dev-lastra-noise">
			<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
		</filter>
		<rect width="100%" height="100%" filter="url(#dev-lastra-noise)" />
	</svg>

	<div class="absolute inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
		<div
			class="absolute top-[-20vh] left-[-10vw] w-[50vw] h-[60vh] rounded-full bg-primary/10 blur-[120px]"
		></div>
		<div
			class="absolute top-[40vh] right-[-10vw] w-[45vw] h-[50vh] rounded-full bg-iris/10 blur-[120px]"
		></div>
		<div
			class="absolute top-[80vh] left-[20vw] w-[40vw] h-[55vh] rounded-full bg-foam/10 blur-[120px]"
		></div>
	</div>

	{@render children()}
</div>
