<script lang="ts">
	import '@fontsource-variable/playfair-display';
	import '@fontsource-variable/source-serif-4';
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="dark" />

<svg
	class="fixed inset-0 pointer-events-none h-full w-full opacity-[0.15] -z-20"
	aria-hidden="true"
>
	<filter id="dev-lastra-noise">
		<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
	</filter>
	<rect width="100%" height="100%" filter="url(#dev-lastra-noise)" />
</svg>

<div class="fixed inset-0 pointer-events-none -z-10" aria-hidden="true">
	<div
		class="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-primary/10 blur-[120px]"
	></div>
	<div
		class="absolute bottom-[-10%] right-[-10%] w-[45%] h-[50%] rounded-full bg-iris/10 blur-[120px]"
	></div>
	<div
		class="absolute top-[40%] right-[20%] w-[30%] h-[40%] rounded-full bg-foam/10 blur-[100px]"
	></div>
</div>

{@render children()}
