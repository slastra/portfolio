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
	import '../../app.css';

	let { children } = $props();
</script>

<div class="dark">
	{@render children()}
</div>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		background: oklch(0.18 0.025 295);
	}
</style>
