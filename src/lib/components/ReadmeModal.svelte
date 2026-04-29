<script lang="ts">
	import { onMount } from 'svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import GithubIcon from './GithubIcon.svelte';
	import type { Repo } from '$lib/github';

	interface Props {
		repo: Repo;
		onclose: () => void;
	}

	let { repo, onclose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement>();
	let html = $state<string | null>(null);
	let error = $state<string | null>(null);

	onMount(() => {
		dialogEl?.showModal();
		load();
	});

	async function load() {
		try {
			const res = await fetch(`/api/readme/${repo.name}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { html: string };
			html = data.html;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load readme';
		}
	}

	function close() {
		dialogEl?.close();
	}
</script>

<dialog
	bind:this={dialogEl}
	onclose={onclose}
	class="readme-dialog max-w-3xl w-[min(90vw,48rem)] max-h-[85vh] overflow-hidden rounded-2xl border border-border/60 bg-card/95 backdrop-blur-2xl text-card-foreground p-0 shadow-2xl"
>
	<div class="flex flex-col h-full max-h-[85vh]">
		<header class="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-5 border-b border-border/40 bg-card/95 backdrop-blur-xl">
			<div class="flex flex-col gap-1 min-w-0">
				<span class="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
					readme · slastra/{repo.name}
				</span>
				<h2 class="font-heading font-bold text-2xl leading-tight tracking-tight truncate">
					{repo.name}
				</h2>
			</div>
			<button
				type="button"
				onclick={close}
				class="inline-flex items-center justify-center size-8 rounded-md border border-border/60 bg-card/40 text-foreground/70 hover:text-foreground hover:bg-card hover:border-border transition-all shrink-0"
				aria-label="Close"
			>
				<XIcon class="size-4" />
			</button>
		</header>

		<div class="flex-1 overflow-y-auto px-6 py-6">
			{#if error}
				<p class="font-mono text-xs uppercase tracking-wider text-destructive">
					{error}
				</p>
			{:else if html === null}
				<div class="flex items-center justify-center py-16">
					<div class="size-6 rounded-full border-2 border-border border-t-primary animate-spin"></div>
				</div>
			{:else if html === ''}
				<p class="text-muted-foreground italic text-center py-16">No readme.</p>
			{:else}
				<div class="readme-prose">
					{@html html}
				</div>
			{/if}
		</div>

		<footer class="flex items-center justify-between gap-3 px-6 py-4 border-t border-border/40 bg-card/40">
			<span class="font-mono text-[11px] uppercase tracking-wider text-muted-foreground truncate">
				rendered from github · markdown
			</span>
			<a
				href={repo.html_url}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider text-foreground/70 hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0"
			>
				<GithubIcon class="size-3.5" />
				view on github
			</a>
		</footer>
	</div>
</dialog>

<style>
	.readme-dialog {
		position: fixed;
		inset: 0;
		margin: auto;
	}
	.readme-dialog::backdrop {
		background: oklch(0.18 0.025 295 / 0.7);
		backdrop-filter: blur(8px);
	}
</style>
