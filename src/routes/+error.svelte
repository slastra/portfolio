<script lang="ts">
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	const notFound = $derived(page.status === 404);
	const heading = $derived(notFound ? 'Nothing at this address.' : 'Something went wrong.');
	const detail = $derived(
		notFound
			? 'There’s no project here. It may have been renamed or made private.'
			: 'GitHub or this server had a problem. Try again in a moment.'
	);
</script>

<svelte:head>
	<title>{page.status} — dev.lastra.us</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="min-h-screen flex items-center justify-center px-6 py-16">
	<div class="flex flex-col items-center gap-5 text-center max-w-lg">
		<div class="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
			error · {page.status}
		</div>
		<h1
			class="font-heading font-black leading-none tracking-tight pb-3 text-[clamp(4.5rem,18vw,9rem)]"
		>
			<span class="text-foreground">{page.status}</span><span class="text-primary">.</span>
		</h1>
		<p class="font-heading text-2xl text-foreground/85 leading-snug">{heading}</p>
		<p class="text-foreground/60">{detail}</p>
		<a
			href="/"
			class="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border/60 bg-card/40 font-mono text-xs uppercase tracking-wider text-foreground/80 hover:text-foreground hover:bg-card/80 hover:border-border transition-all"
		>
			<ArrowLeftIcon class="size-3.5" />
			all projects
		</a>
	</div>
</main>
