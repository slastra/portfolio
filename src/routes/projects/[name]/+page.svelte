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
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { codeShares, languageColor, percent, segments } from '#lib/github.js';
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
	const mix = $derived(segments(codeShares(repo.languages)));
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
	<header class="sticky top-0 z-30 border-b border-rule bg-background/95 backdrop-blur-sm">
		<div class="flex h-12 items-center justify-between gap-4 px-4 lg:px-6">
			<nav aria-label="Breadcrumb" class="min-w-0">
				<ol
					class="flex min-w-0 items-center gap-x-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
				>
					<li class="shrink-0">
						<a href="/" class="flex items-center gap-1.5 hover:text-foreground transition-colors">
							<ArrowLeftIcon class="size-3" />
							dev.lastra.us
						</a>
					</li>
					<li aria-hidden="true" class="opacity-40 max-sm:hidden">/</li>
					<li class="max-sm:hidden"><a href="/" class="hover:text-foreground transition-colors">projects</a></li>
					<li aria-hidden="true" class="opacity-40">/</li>
					<li aria-current="page" class="min-w-0 truncate text-foreground/70 normal-case tracking-[0.15em]">
						{repo.name}
					</li>
				</ol>
			</nav>

			<div class="flex shrink-0 items-center gap-1">
				<a
					href={repo.html_url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex h-8 items-center gap-1.5 border border-border px-2.5 text-xs font-mono uppercase tracking-wider text-foreground/70 hover:text-foreground hover:bg-card/80 transition-colors"
				>
					<GithubIcon class="size-3.5" />
					<span class="max-sm:sr-only">code</span>
				</a>
				{#if repo.homepage}
					<a
						href={repo.homepage}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex h-8 items-center gap-1.5 border border-border px-2.5 text-xs font-mono uppercase tracking-wider text-primary/90 hover:text-primary hover:bg-primary/10 transition-colors"
					>
						<ExternalLinkIcon class="size-3.5" />
						<span class="max-sm:sr-only">live</span>
					</a>
				{/if}
			</div>
		</div>
	</header>

	<!-- Ruled, full-bleed and gapless like the index. Named areas give the phone order (title,
	     details, banner, readme) and the desktop one (details down the right of all three) from a
	     single source order; see .project-grid below. -->
	<main class="project-grid flex-1">
		<div class="[grid-area:title] flex flex-col gap-3 min-w-0 border-b border-rule px-5 py-8 lg:px-10 lg:py-12">
			<h1
				class="font-heading font-black leading-[0.95] tracking-tight text-[clamp(2.5rem,6vw,4.5rem)] break-words"
			>
				{repo.name}
			</h1>
			{#if repo.description}
				<p class="font-heading text-lg sm:text-xl text-foreground/80 max-w-3xl leading-snug">
					{repo.description}
				</p>
			{/if}
		</div>

		<aside aria-label="Project details" class="[grid-area:aside] border-b border-rule lg:border-b-0 lg:border-l">
			<!-- Sticks under the 48px header while the readme scrolls past. -->
			<div class="lg:sticky lg:top-12">
				<!-- Ruled cells: two across on a phone, one per row in the desktop column. -->
				<dl class="grid grid-cols-2 lg:grid-cols-1 -mr-px overflow-hidden">
					{#if repo.archived}
						<div class="fact-cell">
							<dt class="fact-label">status</dt>
							<dd class="fact-value inline-flex items-center gap-1.5">
								<ArchiveIcon class="size-3" />archived
							</dd>
						</div>
					{/if}
					{#if mix.length > 1}
						<div class="fact-cell col-span-full">
							<dt class="fact-label">languages</dt>
							<dd class="flex flex-col gap-2.5">
								<div class="flex h-1.5 gap-px" aria-hidden="true">
									{#each mix as m (m.name)}
										<span style="flex: {m.value} 1 0; background-color: {m.color}"></span>
									{/each}
								</div>
								<ul class="flex flex-wrap gap-x-4 gap-y-1.5 lg:flex-col">
									{#each mix as m (m.name)}
										<li class="fact-value inline-flex items-center gap-2">
											<span class="size-2 shrink-0" style="background-color: {m.color}"></span>
											{m.name}
											<span class="ml-auto pl-2 text-muted-foreground tabular-nums">{percent(m.value)}</span>
										</li>
									{/each}
								</ul>
							</dd>
						</div>
					{:else if repo.language}
						<div class="fact-cell">
							<dt class="fact-label">language</dt>
							<dd class="fact-value inline-flex items-center gap-2">
								<span
									class="size-2"
									style="background-color: {langColor}; box-shadow: 0 0 8px color-mix(in oklch, {langColor} 35%, transparent)"
								></span>
								{repo.language}
							</dd>
						</div>
					{/if}
					{#if repo.stars > 0 || repo.forks > 0}
						<div class="fact-cell">
							<dt class="fact-label">github</dt>
							<dd class="fact-value inline-flex items-center gap-3">
								{#if repo.stars > 0}
									<span class="inline-flex items-center gap-1" title="Stars">
										<StarIcon class="size-3" />{repo.stars}<span class="sr-only"> stars</span>
									</span>
								{/if}
								{#if repo.forks > 0}
									<span class="inline-flex items-center gap-1" title="Forks">
										<GitForkIcon class="size-3" />{repo.forks}<span class="sr-only"> forks</span>
									</span>
								{/if}
							</dd>
						</div>
					{/if}
					{#if repo.license}
						<div class="fact-cell">
							<dt class="fact-label">license</dt>
							<dd class="fact-value">{repo.license}</dd>
						</div>
					{/if}
					<div class="fact-cell">
						<dt class="fact-label">created</dt>
						<dd class="fact-value"><time datetime={repo.created_at}>{formatDate(repo.created_at)}</time></dd>
					</div>
					<div class="fact-cell">
						<dt class="fact-label">updated</dt>
						<dd class="fact-value"><time datetime={repo.pushed_at}>{formatDate(repo.pushed_at)}</time></dd>
					</div>
				</dl>

				{#if repo.topics.length}
					<div class="flex flex-col gap-2.5 px-5 py-4">
						<h2 class="fact-label">topics</h2>
						<ul class="flex flex-wrap gap-1.5">
							{#each repo.topics as topic (topic)}
								<li class="border border-border px-2 py-0.5 font-mono text-[11px] text-foreground/70">
									{topic}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</aside>

		{#if data.showBanner && (showVideo || showImage)}
			<div class="[grid-area:banner] relative aspect-video overflow-hidden border-b border-rule bg-secondary/30">
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

		<article class="[grid-area:readme] min-w-0">
			<div
				class="flex h-10 items-center border-b border-rule px-5 lg:px-10 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
			>
				readme · slastra/{repo.name}
			</div>
			<div class="px-5 py-8 lg:px-10 lg:py-10">
				{#if data.readme === null}
					<p class="font-mono text-xs uppercase tracking-wider text-destructive">
						Couldn't load the readme from GitHub.
					</p>
				{:else if data.readme === ''}
					<p class="text-muted-foreground italic py-16">No readme.</p>
				{:else}
					<div class="readme-prose readme-measure">
						{@html data.readme}
					</div>
				{/if}
			</div>
		</article>
	</main>

	{#if data.prev || data.next}
		<nav aria-label="More projects" class="grid sm:grid-cols-2 border-t border-rule">
			{#each [{ link: data.prev, dir: 'prev' }, { link: data.next, dir: 'next' }] as { link, dir } (dir)}
				{#if link}
					<a
						href={projectPath(link.name)}
						class="group flex flex-col gap-1.5 px-5 py-6 lg:px-10 hover:bg-card/60 transition-colors {dir === 'next'
							? 'sm:col-start-2 sm:items-end sm:text-right max-sm:border-t sm:border-l border-rule'
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

	<SiteFooter>
		<a href="/" class="hover:text-foreground transition-colors"
			><span class="text-foreground/70">dev.lastra.us</span><span class="max-sm:hidden">&nbsp;· all projects</span></a
		>
	</SiteFooter>
</div>

<style>
	.project-grid {
		display: grid;
		/* clip, not hidden: it trims the facts' off-edge rule without becoming a scroll container,
		   which would stop the details column sticking. */
		overflow-x: clip;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'title' 'aside' 'banner' 'readme';
	}
	/* lg. The last row takes the slack so the details column runs the readme's full height. */
	@media (min-width: 64rem) {
		.project-grid {
			grid-template-columns: minmax(0, 1fr) 18rem;
			grid-template-rows: auto auto 1fr;
			grid-template-areas: 'title aside' 'banner aside' 'readme aside';
		}
	}

	/* One ruled fact. Right and bottom rules, so a two-across phone grid shares hairlines; the dl's
	   -mr-px pushes the outer right rule off the edge. */
	.fact-cell {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 1rem 1.25rem;
		border-right: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}

	/* The details rail's label/value pair, repeated for every fact. */
	.fact-label {
		font-family: var(--font-mono);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.3em;
		color: var(--muted-foreground);
	}
	.fact-value {
		font-family: var(--font-mono);
		font-size: 12px;
		color: color-mix(in oklch, var(--foreground) 80%, transparent);
	}
</style>
