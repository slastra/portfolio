<script lang="ts">
	import GithubIcon from './GithubIcon.svelte';
	import ReadmeModal from './ReadmeModal.svelte';
	import StarIcon from '@lucide/svelte/icons/star';
	import GitForkIcon from '@lucide/svelte/icons/git-fork';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import { languageColor, type Repo } from '$lib/github';
	import { cn } from '$lib/utils';

	interface Props {
		repo: Repo;
		index: number;
		total: number;
	}

	let { repo, index, total }: Props = $props();

	let showReadme = $state(false);

	const padded = $derived(String(index + 1).padStart(2, '0'));
	const totalPadded = $derived(String(total).padStart(2, '0'));
	const langColor = $derived(languageColor(repo.language));
	const pushed = $derived(timeAgo(repo.pushed_at));

	function timeAgo(dateStr: string): string {
		const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
		if (diffDays < 1) return 'today';
		if (diffDays < 7) return `${diffDays}d ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
		return `${Math.floor(diffDays / 365)}y ago`;
	}
</script>

<article
	class={cn(
		'group relative flex flex-col bg-card/60 backdrop-blur-xl text-card-foreground rounded-xl border overflow-hidden transition-all duration-500 hover:bg-card hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-primary/5',
		repo.archived && 'opacity-70'
	)}
>
	<div class="relative flex flex-col gap-3 p-5 pt-7 pb-6">
		<div class="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
			<span>{padded} <span class="opacity-40">/ {totalPadded}</span></span>
			{#if repo.archived}
				<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-border/60 bg-secondary/40">
					<ArchiveIcon class="size-2.5" />
					archived
				</span>
			{/if}
		</div>

		<a
			href={repo.html_url}
			target="_blank"
			rel="noopener noreferrer"
			class="block group/title"
		>
			<h2
				class="font-heading font-bold leading-[1.05] tracking-tight text-[clamp(1.75rem,4.5vw,3rem)] transition-colors group-hover/title:text-primary"
			>
				{repo.name}
			</h2>
		</a>

		{#if repo.description}
			<p class="text-[15px] leading-relaxed text-foreground/75">
				{repo.description}
			</p>
		{:else}
			<p class="text-sm italic text-muted-foreground/60">No description.</p>
		{/if}

		<div
			class="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 mt-auto font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
		>
			{#if repo.language}
				<span class="inline-flex items-center gap-1.5">
					<span
						class="size-2 rounded-full"
						style="background-color: {langColor}; box-shadow: 0 0 8px color-mix(in oklch, {langColor} 35%, transparent)"
					></span>
					<span class="normal-case tracking-normal text-foreground/70">{repo.language}</span>
				</span>
			{/if}
			{#if repo.stars > 0}
				<span class="inline-flex items-center gap-1">
					<StarIcon class="size-3" />
					{repo.stars}
				</span>
			{/if}
			{#if repo.forks > 0}
				<span class="inline-flex items-center gap-1">
					<GitForkIcon class="size-3" />
					{repo.forks}
				</span>
			{/if}
			<span class="ml-auto opacity-70">{pushed}</span>
		</div>

		<div class="flex items-center gap-1 pt-1 -mb-1">
			<button
				type="button"
				onclick={() => (showReadme = true)}
				class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider text-foreground/70 hover:text-foreground hover:bg-secondary/60 transition-colors"
			>
				<BookOpenIcon class="size-3.5" />
				readme
			</button>
			<a
				href={repo.html_url}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider text-foreground/70 hover:text-foreground hover:bg-secondary/60 transition-colors"
			>
				<GithubIcon class="size-3.5" />
				code
			</a>
			{#if repo.homepage}
				<a
					href={repo.homepage}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider text-primary/90 hover:text-primary hover:bg-primary/10 transition-colors"
				>
					<ExternalLinkIcon class="size-3.5" />
					live
				</a>
			{/if}
		</div>
	</div>

	<span
		aria-hidden="true"
		class="absolute left-0 top-0 bottom-0 w-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
		style="background: linear-gradient(to bottom, transparent, {langColor} 50%, transparent)"
	></span>
</article>

{#if showReadme}
	<ReadmeModal {repo} onclose={() => (showReadme = false)} />
{/if}
