<script lang="ts">
	import RepoCard from '$lib/components/RepoCard.svelte';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import GithubIcon from '$lib/components/GithubIcon.svelte';
	import { mode, toggleMode } from 'mode-watcher';

	let { data } = $props();

	const formattedDate = $derived(
		new Date(data.fetchedAt).toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		})
	);
</script>

<svelte:head>
	<title>dev.lastra.us — projects by shaun lastra</title>
	<meta
		name="description"
		content="Public projects by Shaun Lastra. A live index of open-source work pulled directly from GitHub."
	/>
	<meta property="og:title" content="dev.lastra.us" />
	<meta property="og:description" content="Public projects by Shaun Lastra." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://dev.lastra.us" />
</svelte:head>

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
						<RepoCard {repo} index={i} total={data.repos.length} />
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
