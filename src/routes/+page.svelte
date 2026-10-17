<script lang="ts">
	import { page } from '$app/state';
	import RepoCard from '#lib/components/RepoCard.svelte';
	import ReadmeModal from '#lib/components/ReadmeModal.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import GithubIcon from '#lib/components/GithubIcon.svelte';
	import { mode, toggleMode } from 'mode-watcher';
	import { buildJsonLd, DEFAULT_OG_IMAGE, PAGE_DESCRIPTION, PAGE_TITLE, PERSON } from '#lib/seo.js';

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
	<header class="border-b border-border/40">
		<div class="max-w-[1600px] mx-auto px-6 lg:px-10 py-10 lg:py-14">
			<div class="flex items-start justify-between gap-6">
				<div class="flex flex-col gap-3 min-w-0">
					<div class="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
						index · MMXXVI
					</div>
					<h1
						class="font-heading font-black leading-[0.9] tracking-tight text-[clamp(2.75rem,8vw,6rem)]"
					>
						<span class="text-foreground">dev</span><span class="text-primary">.</span><span
							class="text-foreground/70 italic font-normal"
						>lastra.us</span>
					</h1>
					<p class="font-heading text-lg sm:text-xl text-foreground/80 mt-2 max-w-2xl leading-snug">
						<span class="font-semibold text-foreground">{PERSON.name}</span><span
							class="text-muted-foreground px-1.5">·</span>{PERSON.description.replace(/^Software developer\. /, '')}
					</p>
					<p class="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1">
						{data.repos.length} public projects · synced {formattedDate}
					</p>
				</div>

				<div class="flex items-center gap-1 shrink-0">
					<a
						href="https://github.com/slastra"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center justify-center size-9 rounded-md border border-border/60 bg-card/40 text-foreground/70 hover:text-foreground hover:bg-card/80 hover:border-border transition-all"
						aria-label="GitHub profile"
					>
						<GithubIcon class="size-4" />
					</a>
					<button
						type="button"
						onclick={toggleMode}
						class="inline-flex items-center justify-center size-9 rounded-md border border-border/60 bg-card/40 text-foreground/70 hover:text-foreground hover:bg-card/80 hover:border-border transition-all"
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
		</div>
	</header>

	<main class="flex-1 max-w-[1600px] mx-auto w-full px-6 lg:px-10 py-10 lg:py-14">
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
			<div
				class="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 [&>div]:mb-5 [&>div]:break-inside-avoid"
			>
				{#each data.repos as repo, i (repo.name)}
					<div class="reveal" style="animation-delay: {Math.min(i * 35, 600)}ms">
						<RepoCard
							{repo}
							index={i}
							total={data.repos.length}
							bannerRank={bannerRank.get(repo.name) ?? 0}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</main>

	<footer class="border-t border-border/40 mt-10">
		<div
			class="max-w-[1600px] mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
		>
			<span>
				<span class="text-foreground/70">dev.lastra.us</span> · pulled live from github
			</span>
			<span class="opacity-70">© MMXXVI · shaun lastra</span>
		</div>
	</footer>
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
