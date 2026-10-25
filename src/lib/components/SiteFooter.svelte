<script lang="ts">
	import type { Snippet } from 'svelte';

	// Pinned to the bottom of the viewport on every page. sticky rather than fixed keeps it in the
	// flow, so it sits at the end of a short page instead of floating over empty space.
	let { children }: { children: Snippet } = $props();
</script>

<footer class="sticky bottom-0 z-30 border-t border-rule bg-background/95 backdrop-blur-sm">
	<div
		class="flex h-9 items-center justify-between gap-4 px-4 lg:px-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
	>
		<div class="min-w-0 truncate">{@render children()}</div>
		<span class="shrink-0 opacity-70">© MMXXVI · shaun lastra</span>
	</div>
</footer>
