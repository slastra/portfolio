<script lang="ts">
	import { page } from '$app/state';
	import RepoCard from '#lib/components/RepoCard.svelte';
	import ReadmeModal from '#lib/components/ReadmeModal.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import GithubIcon from '#lib/components/GithubIcon.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { mode, toggleMode } from 'mode-watcher';
	import {
		buildJsonLd,
		DEFAULT_OG_IMAGE,
		PAGE_DESCRIPTION,
		PAGE_TITLE,
		PERSON,
		projectPath
	} from '#lib/seo.js';
	import LanguageStrip from '#lib/components/LanguageStrip.svelte';
	import ActivityStrip from '#lib/components/ActivityStrip.svelte';
	import { usesLanguage, type LanguageView } from '#lib/github.js';
	import { masonry, type Gaps } from '#lib/masonry.js';

	let { data } = $props();

	const jsonLd = $derived(buildJsonLd(data.repos, data.fetchedAt));

	// However the modal closes (Esc, the close button, Back), keyboard focus goes back to the card
	// that opened it. The dialog's own focus restore doesn't cover Back, which unmounts it without
	// a close(), and Safari never focused the clicked link to begin with.
	let openProject: string | null = null;
	$effect(() => {
		const name = page.state.project?.repo.name ?? null;
		if (!name && openProject) {
			document
				.querySelector<HTMLElement>(`[data-project-title="${CSS.escape(openProject)}"]`)
				?.focus({ preventScroll: true });
		}
		openProject = name;
	});

	// Tilt direction is assigned by position among the banner-bearing repos rather than drawn
	// from each repo's name hash. Independent per-name draws have no mechanism keeping the two
	// directions balanced — the first cut hashed 8 of 9 counter-clockwise, which reads as a
	// deliberate lean. Ranking here guarantees an even split; the angle itself stays hashed.
	const bannerRank = $derived(
		new Map(data.repos.filter((r) => r.media).map((r, i) => [r.name, i]))
	);

	// Index position is the card's identity (its 01 / 34), so it survives filtering.
	const position = $derived(new Map(data.repos.map((r, i) => [r.name, i])));

	let language = $state<string | null>(null);
	let view = $state<LanguageView>('projects');
	let preview = $state<string | null>(null);

	// The empty foot of each column that ends short of the tallest, hatched in (see masonry.ts).
	let layout = $state<Gaps>({ gaps: [], width: 0, height: 0 });
	const shown = $derived(
		language ? data.repos.filter((r) => usesLanguage(r, language!, view)) : data.repos
	);

	// The most recently pushed repo, for the intro tile's eyebrow. Index order is by stars, so it
	// has to be looked for rather than taken from the top.
	const latest = $derived(
		data.repos.reduce<(typeof data.repos)[number] | null>(
			(a, r) => (!a || r.pushed_at > a.pushed_at ? r : a),
			null
		)
	);

	// Finer than the cards' "today": the latest push is usually hours old, and that's the point.
	function pushedAgo(iso: string): string {
		const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
	}

	const formattedDate = $derived(
		new Date(data.fetchedAt).toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		})
	);
</script>

<Seo
	title={PAGE_TITLE}
	description={PAGE_DESCRIPTION}
	path="/"
	image={DEFAULT_OG_IMAGE}
	imageAlt="dev.lastra.us — projects by {PERSON.name}"
	ogType="profile"
	{jsonLd}
>
	<link rel="me" href="https://github.com/slastra" />
	<meta property="profile:first_name" content={PERSON.givenName} />
	<meta property="profile:last_name" content={PERSON.familyName} />
	<meta property="profile:username" content="slastra" />
</Seo>

<div class="min-h-screen flex flex-col">
	<!-- Pinned. Two rows: the masthead, then the language chips, with the language bar itself as
	     the header's bottom edge (LanguageStrip). The name and bio are the grid's first tile, still
	     near the top of the document for anyone searching the name. -->
	<header class="sticky top-0 z-30 bg-background/95 backdrop-blur-sm">
		<!-- Three columns so the activity strip sits on the true centre line, whatever the widths
		     of the wordmark and the icons either side. -->
		<div class="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 lg:px-6 border-b border-rule">
			<h1 class="justify-self-start font-heading font-black text-2xl leading-none tracking-tight">
				<span class="text-foreground">dev</span><span class="text-primary">.</span><span
					class="text-foreground/70 italic font-normal">lastra.us</span
				>
			</h1>

			<div class="max-md:hidden">
				{#if data.activity}
					<ActivityStrip activity={data.activity} />
				{/if}
			</div>

			<!-- Pinned to the third column: where the activity strip is hidden, auto-placement would
			     otherwise move these into its empty middle slot. -->
			<div class="col-start-3 flex shrink-0 items-center gap-1 justify-self-end">
				<a
					href="https://github.com/slastra"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center justify-center size-8 border border-border text-foreground/70 hover:text-foreground hover:bg-card/80 transition-colors"
					aria-label="GitHub profile"
				>
					<GithubIcon class="size-4" />
				</a>
				<button
					type="button"
					onclick={toggleMode}
					class="inline-flex items-center justify-center size-8 border border-border text-foreground/70 hover:text-foreground hover:bg-card/80 transition-colors"
					aria-label="Toggle theme"
				>
					{#if mode.current === 'dark'}
						<SunIcon class="size-4" />
					{:else}
						<MoonIcon class="size-4" />
					{/if}
				</button>
			</div>
		</div>

		<LanguageStrip repos={data.repos} bind:language bind:view bind:preview />
	</header>

	<!-- Full bleed: auto-fill adds a column for every 20rem of width. Cells draw their own side and
	     bottom rules, overlapping their neighbours by 1px; the outermost side rules fall just past
	     each edge and overflow-x-clip trims them. The container query is for the intro tile, which
	     may only span two columns once there are two. -mb-px does the same along the bottom: at the
	     end of the page the footer's top border would sit right under the grid's bottom rule, a
	     2px double line, so it overlaps and stands in for it. -->
	<main class="@container flex-1 overflow-x-clip -mb-px">
		{#if data.error && data.repos.length === 0}
			<div class="py-24 text-center">
				<p class="font-heading text-2xl text-muted-foreground">
					Couldn't reach GitHub right now.
				</p>
				<p class="font-mono text-xs uppercase tracking-wider text-muted-foreground/70 mt-3">
					{data.error}
				</p>
			</div>
		{:else if data.repos.length === 0}
			<div class="py-24 text-center font-heading text-2xl text-muted-foreground">
				Nothing here yet.
			</div>
		{:else}
			<div class="relative">
				<div
					{@attach masonry((l) => (layout = l))}
					class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] items-start -mr-px"
				>
					<section
						aria-label="About"
						class="@min-[40rem]:col-span-2 -ml-px flex flex-col gap-5 border-x border-b border-rule p-5 lg:p-8"
					>
						{#if latest}
							<div class="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
								latest push<span aria-hidden="true" class="px-2 opacity-40">·</span><a
									href={projectPath(latest.name)}
									class="normal-case tracking-[0.15em] text-foreground/80 hover:text-primary transition-colors"
									>{latest.name}</a
								><span aria-hidden="true" class="px-2 opacity-40">·</span><time
									datetime={latest.pushed_at}>{pushedAgo(latest.pushed_at)}</time
								>
							</div>
						{/if}
						<p class="font-heading text-2xl lg:text-3xl leading-snug text-foreground/80 max-w-3xl">
							<span class="font-semibold text-foreground">{PERSON.name}</span><span
								class="text-muted-foreground px-1.5">·</span>{PERSON.description}
						</p>
						<p class="grid font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
							<!-- Both lines share one cell so the paragraph keeps the taller one's height: on a
							     phone the synced line wraps to two rows and the filter line fits on one, which
							     moved everything below it whenever a filter was set. -->
							<span class="col-start-1 row-start-1" class:invisible={language} aria-hidden={!!language}>
								<span class="whitespace-nowrap">{data.repos.length} public projects</span> ·
								<span class="whitespace-nowrap">synced {formattedDate}</span>
							</span>
							<span class="col-start-1 row-start-1" aria-live="polite">
								{#if language && view === 'code'}
									{shown.length} of {data.repos.length} projects use {language}
								{:else if language}
									{shown.length} of {data.repos.length} projects · {language}
								{/if}
							</span>
						</p>
					</section>

					{#each shown as repo, i (repo.name)}
						<!-- A style: directive, not a style attribute: the delay changes with the filter, and
						     re-rendering the attribute would wipe the grid-row-end that masonry sets here. -->
						<div
							class="reveal -ml-px"
							class:previewed-out={preview && !usesLanguage(repo, preview, view)}
							style:animation-delay="{Math.min(i * 35, 600)}ms"
							style:--ripple="{Math.min(i * 12, 260)}ms"
						>
							<RepoCard
								{repo}
								index={position.get(repo.name) ?? i}
								total={data.repos.length}
								bannerRank={bannerRank.get(repo.name) ?? 0}
							/>
						</div>
					{/each}
				</div>

				<!-- Hatched fills under the columns that end early, ruled like cells (the same 1px
				     overlap to the left) so the grid closes in one straight line along the bottom.
				     The hatch is sized to the whole grid and offset to each fill's position, so the
				     diagonals run on unbroken from one fill into the next. -->
				<div aria-hidden="true" class="pointer-events-none absolute inset-0">
					{#each layout.gaps as g (g.left)}
						<div
							class="masonry-gap absolute border-x border-b border-rule"
							style:left="{g.left - 1}px"
							style:top="{g.top}px"
							style:width="{g.width + 1}px"
							style:height="{g.height}px"
							style:background-size="{layout.width}px {layout.height}px"
							style:background-position="{-(g.left - 1)}px {-g.top}px"
						></div>
					{/each}
				</div>
			</div>
		{/if}
	</main>

	<SiteFooter>
		<span class="text-foreground/70">dev.lastra.us</span><span class="max-sm:hidden"
			>&nbsp;· pulled live from github</span
		>
	</SiteFooter>
</div>

<!-- Opened by RepoCard through a shallow navigation, so the URL already reads /projects/<name>.
     Closing goes back through history rather than just clearing state, or Back would reopen it. -->
{#if page.state.project}
	<ReadmeModal
		repo={page.state.project.repo}
		html={page.state.project.readme}
		onclose={() => history.back()}
	/>
{/if}
