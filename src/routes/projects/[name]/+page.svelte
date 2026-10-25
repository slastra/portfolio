<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import StarIcon from '@lucide/svelte/icons/star';
	import GitForkIcon from '@lucide/svelte/icons/git-fork';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import GithubIcon from '#lib/components/GithubIcon.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { languageColor } from '#lib/github.js';
	import {
		buildProjectJsonLd,
		PERSON,
		projectOgImage,
		projectPath,
		projectTitle
	} from '#lib/seo.js';

	let { data } = $props();

	const repo = $derived(data.repo);
	const langColor = $derived(languageColor(repo.language));
	const jsonLd = $derived(buildProjectJsonLd(repo, data.summary));

	// Same fallback chain as the card: a video the browser won't decode (HEVC on Linux Chrome)
	// drops to the still, and a still that fails drops the banner. Failures are keyed by URL
	// because prev/next navigation reuses this component, so per-page flags would carry over.
	const failed = new SvelteSet<string>();
	const video = $derived(repo.media?.video ?? null);
	const image = $derived(repo.media?.image ?? null);
	const showVideo = $derived(!!video && !failed.has(video));
	const showImage = $derived(!showVideo && !!image && !failed.has(image));
	// Bound as a property for the same reason as RepoCard: the attribute only seeds defaultMuted,
	// so a client-rendered element would stay unmuted and Chrome would silently block autoplay.
	let muted = $state(true);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<Seo
	title={projectTitle(repo.name)}
	description={data.summary}
	path={projectPath(repo.name)}
	image={projectOgImage(repo.name)}
	imageAlt="{repo.name} by {PERSON.name}"
	{jsonLd}
/>

<div class="min-h-screen flex flex-col">
	<header class="border-b border-border/40">
		<div class="max-w-[1100px] mx-auto px-6 lg:px-10 py-10 lg:py-14 flex flex-col gap-5">
			<nav aria-label="Breadcrumb">
				<ol
					class="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
				>
					<li>
						<a href="/" class="flex items-center gap-1.5 hover:text-foreground transition-colors">
							<ArrowLeftIcon class="size-3" />
							{PERSON.name}
						</a>
					</li>
					<li aria-hidden="true" class="opacity-40">/</li>
					<li><a href="/" class="hover:text-foreground transition-colors">projects</a></li>
					<li aria-hidden="true" class="opacity-40">/</li>
					<li aria-current="page" class="text-foreground/70 normal-case tracking-[0.15em] truncate">
						{repo.name}
					</li>
				</ol>
			</nav>

			<div class="flex flex-col gap-3 min-w-0">
				<h1
					class="font-heading font-black leading-[0.95] tracking-tight text-[clamp(2.5rem,7vw,5rem)] break-words"
				>
					{repo.name}
				</h1>
				{#if repo.description}
					<p class="font-heading text-lg sm:text-xl text-foreground/80 max-w-3xl leading-snug">
						{repo.description}
					</p>
				{/if}
			</div>

			<div
				class="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
			>
				{#if repo.archived}
					<span
						class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-border/60 bg-secondary/40"
					>
						<ArchiveIcon class="size-2.5" />
						archived
					</span>
				{/if}
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
					<span class="inline-flex items-center gap-1"><StarIcon class="size-3" />{repo.stars}</span>
				{/if}
				{#if repo.forks > 0}
					<span class="inline-flex items-center gap-1"><GitForkIcon class="size-3" />{repo.forks}</span>
				{/if}
				{#if repo.license}
					<span>{repo.license}</span>
				{/if}
				<span>
					created <time datetime={repo.created_at}>{formatDate(repo.created_at)}</time>
				</span>
				<span>
					updated <time datetime={repo.pushed_at}>{formatDate(repo.pushed_at)}</time>
				</span>
			</div>

			{#if repo.topics.length}
				<ul class="flex flex-wrap gap-1.5" aria-label="Topics">
					{#each repo.topics as topic (topic)}
						<li
							class="px-2 py-0.5 rounded-full border border-border/60 bg-card/40 font-mono text-[11px] text-foreground/70"
						>
							{topic}
						</li>
					{/each}
				</ul>
			{/if}

			<div class="flex flex-wrap items-center gap-1 -ml-2.5">
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
	</header>

	<main class="flex-1 max-w-[1100px] mx-auto w-full px-6 lg:px-10 py-10 lg:py-14 flex flex-col gap-10">
		{#if data.showBanner && (showVideo || showImage)}
			<div class="relative aspect-video overflow-hidden rounded-xl border border-border/60 bg-secondary/30">
				{#if showVideo}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={video}
						bind:muted
						autoplay
						loop
						playsinline
						onerror={() => video && failed.add(video)}
						class="size-full object-cover object-center"
					></video>
				{:else}
					<img
						src={image}
						alt="Screenshot of {repo.name}"
						decoding="async"
						onerror={() => image && failed.add(image)}
						class="size-full object-cover object-center"
					/>
				{/if}
			</div>
		{/if}

		<article class="rounded-2xl border border-border/60 bg-card/60 px-6 py-6 sm:px-10 sm:py-10">
			<div
				class="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-6 pb-4 border-b border-border/40"
			>
				readme · slastra/{repo.name}
			</div>
			{#if data.readme === null}
				<p class="font-mono text-xs uppercase tracking-wider text-destructive">
					Couldn't load the readme from GitHub.
				</p>
			{:else if data.readme === ''}
				<p class="text-muted-foreground italic text-center py-16">No readme.</p>
			{:else}
				<div class="readme-prose">
					{@html data.readme}
				</div>
			{/if}
		</article>

		{#if data.prev || data.next}
			<nav aria-label="More projects" class="grid gap-4 sm:grid-cols-2">
				{#each [{ link: data.prev, dir: 'prev' }, { link: data.next, dir: 'next' }] as { link, dir } (dir)}
					{#if link}
						<a
							href={projectPath(link.name)}
							class="group flex flex-col gap-1.5 rounded-xl border border-border/60 bg-card/40 px-5 py-4 hover:bg-card hover:border-border transition-colors {dir ===
							'next'
								? 'sm:col-start-2 sm:items-end sm:text-right'
								: ''}"
						>
							<span
								class="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
							>
								{#if dir === 'prev'}<ArrowLeftIcon class="size-3" /> previous{:else}next <ArrowRightIcon
										class="size-3"
									/>{/if}
							</span>
							<span
								class="font-heading font-bold text-2xl leading-tight tracking-tight transition-colors group-hover:text-primary break-words"
							>
								{link.name}
							</span>
							{#if link.description}
								<span class="text-sm text-foreground/60 line-clamp-2">{link.description}</span>
							{/if}
						</a>
					{/if}
				{/each}
			</nav>
		{/if}
	</main>

	<footer class="border-t border-border/40 mt-10">
		<div
			class="max-w-[1100px] mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
		>
			<a href="/" class="hover:text-foreground transition-colors">
				<span class="text-foreground/70">dev.lastra.us</span> · all projects
			</a>
			<span class="opacity-70">© MMXXVI · shaun lastra</span>
		</div>
	</footer>
</div>
