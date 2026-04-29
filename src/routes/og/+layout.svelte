<script lang="ts">
	import '@fontsource-variable/playfair-display';
	import '@fontsource-variable/source-serif-4';
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
