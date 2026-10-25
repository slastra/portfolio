<script lang="ts">
	import { onMount } from 'svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import GithubIcon from './GithubIcon.svelte';
	import type { Repo } from '#lib/github.js';
	import { projectTitle } from '#lib/seo.js';

	interface Props {
		repo: Repo;
		/** Rendered README from the project page's load; null when GitHub couldn't be reached. */
		html: string | null;
		onclose: () => void;
	}

	let { repo, html, onclose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement>();

	onMount(() => {
		dialogEl?.showModal();
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		// The URL already reads /projects/<name>, so the tab should say so too.
		const previousTitle = document.title;
		document.title = projectTitle(repo.name);
		return () => {
			document.body.style.overflow = previousOverflow;
			document.title = previousTitle;
		};
	});

	// A README's table of contents links to #section ids. Letting those through would change the
	// URL hash under the shallow route, so scroll the dialog to the heading instead.
	function followHashLink(event: MouseEvent) {
		const link = (event.target as Element).closest('a[href^="#"]');
		if (!link || !dialogEl) return;
		const id = decodeURIComponent(link.getAttribute('href')!.slice(1));
		const target = dialogEl.querySelector(`[id="${CSS.escape(id)}"]`);
		if (!target) return;
		event.preventDefault();
		const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
		target.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' });
	}

	function close() {
		dialogEl?.close();
	}
</script>

<dialog
	bind:this={dialogEl}
	onclose={onclose}
	class="readme-dialog max-w-3xl w-[min(90vw,48rem)] max-h-[85vh] overflow-hidden border border-rule bg-card/95 backdrop-blur-2xl text-card-foreground p-0 shadow-2xl"
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
			{#if html === null}
				<p class="font-mono text-xs uppercase tracking-wider text-destructive">
					Couldn't load the readme from GitHub.
				</p>
			{:else if html === ''}
				<p class="text-muted-foreground italic text-center py-16">No readme.</p>
			{:else}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions
				     (delegated: the clicks are on the links inside, which are keyboard-reachable) -->
				<div class="readme-prose" onclick={followHashLink}>
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
