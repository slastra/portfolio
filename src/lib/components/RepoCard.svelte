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
		/** Position among repos that have a banner; decides which way this one leans. */
		bannerRank: number;
	}

	let { repo, index, total, bannerRank }: Props = $props();

	let showReadme = $state(false);
	// The URL comes from a verified tree entry, but raw.githubusercontent can still fail —
	// drop the banner rather than leave a broken image in the card.
	// hyprglaze's demo.mp4 is HEVC, which Chrome won't decode — when the browser rejects the
	// video we drop to the repo's still rather than leaving a dead frame.
	let videoFailed = $state(false);
	let imageFailed = $state(false);
	let mediaLoaded = $state(false);

	const showVideo = $derived(!!repo.media?.video && !videoFailed);
	const showImage = $derived(!showVideo && !!repo.media?.image && !imageFailed);
	const hasMedia = $derived(showVideo || showImage);

	// Floor the magnitude: a uniform spread across [-MAX, MAX] keeps landing near zero, and a
	// 0.06deg tilt just reads as a straight image that someone got slightly wrong.
	const MIN_TILT = 1.5;
	const MAX_TILT = 4;

	// Seeded off the repo name rather than Math.random(): the server and the client have to
	// arrive at the same angle or hydration mismatches, and a re-roll on every reload would
	// make the grid feel unstable. The murmur3 finalizer avalanches the bits so that names
	// sharing a prefix don't land on near-identical angles.
	function seed(s: string): number {
		let h = 0;
		for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
		h ^= h >>> 16;
		h = Math.imul(h, 0x85ebca6b);
		h ^= h >>> 13;
		h = Math.imul(h, 0xc2b2ae35);
		h ^= h >>> 16;
		return h >>> 0;
	}

	// Magnitude is hashed (so it looks arbitrary and stays put), direction alternates by rank
	// (so the two directions stay even). Hashing the sign as well is what produced the lean —
	// nothing in independent draws forces them to balance across only nine cards.
	const tilt = $derived.by(() => {
		const degrees =
			MIN_TILT + ((seed(repo.name) % 1000) / 999) * (MAX_TILT - MIN_TILT);
		return bannerRank % 2 === 0 ? degrees : -degrees;
	});

	// A second, independent draw off the same hash so the punch-in doesn't track the tilt —
	// otherwise the most-tilted card is always the most zoomed and the variation reads as a
	// single dial rather than two.
	const MIN_PUNCH = 1.06;
	const MAX_PUNCH = 1.2;
	const punch = $derived(
		MIN_PUNCH + ((seed(`${repo.name}:zoom`) % 1000) / 999) * (MAX_PUNCH - MIN_PUNCH)
	);

	// Rotating a cover-fitted image bares the corners, so scale up by exactly enough to keep
	// the 16/9 frame covered, then apply the punch-in on top of that floor.
	const mediaZoom = $derived.by(() => {
		const rad = (Math.abs(tilt) * Math.PI) / 180;
		return (Math.cos(rad) + (16 / 9) * Math.sin(rad)) * punch;
	});

	// `muted` has to be bound as a property, not left as an attribute. The content attribute only
	// seeds defaultMuted, so an element created client-side stays muted=false, and Chrome then
	// blocks autoplay silently — no error, no network request, just a permanently blank frame.
	let muted = $state(true);
	let videoEl = $state<HTMLVideoElement>();

	// Drive playback off visibility instead of the autoplay attribute: hyprglaze's demo.mp4 is
	// ~10MB, and preload="none" plus an explicit play() keeps that off the wire until the card
	// is actually near the viewport.
	$effect(() => {
		const el = videoEl;
		if (!el) return;

		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) el.play().catch(() => {});
				else el.pause();
			},
			{ rootMargin: '200px' }
		);
		io.observe(el);
		return () => io.disconnect();
	});

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
		// No backdrop-blur here. The only thing behind a card is the atmosphere in +layout.svelte,
		// which is already three blur-[120px] blobs — blurring an established blur again buys
		// virtually nothing visually, while forcing every card onto Chrome's backdrop-filter path.
		// That path re-samples the blurred gradient whenever the card lifts on hover, which is
		// where the banding over neighbouring cards comes from (and why Firefox is clean).
		'group relative flex flex-col bg-card/60 text-card-foreground rounded-xl border overflow-hidden transition-all duration-500 hover:bg-card hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-primary/5',
		repo.archived && 'opacity-70'
	)}
>
	{#if hasMedia}
		<a
			href={repo.html_url}
			target="_blank"
			rel="noopener noreferrer"
			class="block relative aspect-video overflow-hidden bg-secondary/30 border-b border-border/40"
			tabindex="-1"
			aria-hidden="true"
		>
			{#if !mediaLoaded}
				<div class="tv-static absolute inset-0"></div>
			{/if}

			<!-- Tilt and zoom sit on the wrapper so the hover scale can stay a plain class on the
			     media itself; the two transforms then compose instead of overwriting each other. -->
			<div
				class="size-full transition-opacity duration-500"
				style="transform: rotate({tilt.toFixed(2)}deg) scale({mediaZoom.toFixed(4)}); opacity: {mediaLoaded
					? 1
					: 0}"
			>
				{#if showVideo}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={videoEl}
						bind:muted
						src={repo.media?.video}
						loop
						playsinline
						preload="none"
						onloadeddata={() => (mediaLoaded = true)}
						onerror={() => (videoFailed = true)}
						class="size-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.04]"
					></video>
				{:else}
					<img
						src={repo.media?.image}
						alt=""
						loading="lazy"
						decoding="async"
						onload={() => (mediaLoaded = true)}
						onerror={() => (imageFailed = true)}
						class="size-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.04]"
					/>
				{/if}
			</div>
		</a>
	{/if}

	<div class={cn('relative flex flex-col gap-3 p-5 pb-6', hasMedia ? 'pt-5' : 'pt-7')}>
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
