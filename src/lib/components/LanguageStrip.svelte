<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import {
		codeShares,
		percent,
		segments,
		type LanguageShare,
		type LanguageView,
		type Repo
	} from '#lib/github.js';

	interface Props {
		repos: Repo[];
		/** The committed filter; null shows everything. */
		language: string | null;
		view: LanguageView;
		/** The language under the pointer or keyboard focus, for the grid to preview. */
		preview: string | null;
	}

	let {
		repos,
		language = $bindable(),
		view = $bindable(),
		preview = $bindable()
	}: Props = $props();

	// Most-used first; ties alphabetical so the strip doesn't reshuffle between syncs.
	const byProjects = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const r of repos) if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
		return [...counts]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([name, count]) => ({ name, value: count }));
	});

	// Every repo's bytes pooled, so a big codebase outweighs a small one. Languages under 1% of
	// the total fold into "other", which would otherwise be a dozen hairline slivers.
	const byCode = $derived.by(() => {
		const totals = new Map<string, number>();
		for (const r of repos) for (const l of r.languages) totals.set(l.name, (totals.get(l.name) ?? 0) + l.bytes);
		const pooled: LanguageShare[] = [...totals].map(([name, bytes]) => ({ name, bytes }));
		return codeShares(pooled.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name)));
	});

	// Without a token there are no byte counts, so the strip stays a count of projects.
	const hasCode = $derived(byCode.length > 0);
	const views = $derived<LanguageView[]>(hasCode ? ['projects', 'code'] : ['projects']);
	const itemsFor = (v: LanguageView) => segments(v === 'code' ? byCode : byProjects);
	const items = $derived(itemsFor(view === 'code' && hasCode ? 'code' : 'projects'));

	// What "other" stands for, for its tooltip.
	const otherNames = $derived.by(() => {
		const shown = new Set(items.filter((s) => s.name !== 'other').map((s) => s.name));
		const names = new Set<string>();
		for (const r of repos) for (const l of r.languages) if (!shown.has(l.name)) names.add(l.name);
		return [...names].sort().join(', ');
	});

	const focus = $derived(preview ?? language);

	function label(value: number, v: LanguageView = view): string {
		return v === 'code' ? percent(value) : String(value);
	}

	function choose(name: string) {
		language = language === name ? null : name;
	}

	function switchView(next: LanguageView) {
		view = next;
		// A filter can outlive the switch only if its language is in the new view: GLSL is part of
		// several codebases but no project's primary language, so it would match nothing.
		if (language && !items.some((s) => s.name === language)) language = null;
	}

	// Whether chips are hidden past the right edge of the scrolling row, for the fade.
	let scroller = $state<HTMLElement>();
	let fadeEnd = $state(false);
	function measureOverflow() {
		if (scroller) fadeEnd = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
	}
	$effect(() => {
		if (!scroller) return;
		const observer = new ResizeObserver(measureOverflow);
		observer.observe(scroller);
		return () => observer.disconnect();
	});
	// The scroll width also changes with the view and the filter token, without a resize.
	$effect(() => {
		void view;
		void language;
		queueMicrotask(measureOverflow);
	});

	// Touch has no hover, and a tap would leave the preview stuck on, so only a mouse previews.
	function hover(event: PointerEvent, name: string | null) {
		if (event.pointerType === 'mouse') preview = name;
	}
</script>

<!-- The header's second row and its bottom edge. The chips scroll sideways rather than wrap, so
     the pinned header is the same height in either view, with or without a filter. -->
<section aria-labelledby="languages-heading">
	<div
		class="flex h-10 items-center gap-4 px-4 lg:px-6 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
	>
		<h2 id="languages-heading" class="shrink-0 max-sm:sr-only">languages</h2>

		<div
			bind:this={scroller}
			onscroll={measureOverflow}
			class="chip-scroll min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]"
			class:fade-end={fadeEnd}
		>
			<!-- Both views' chips share one grid cell and only the current one shows, so the row's
			     scroll width doesn't jump when the view changes under a scrolled position. -->
			<div class="grid w-max">
				{#each views as v (v)}
					{@const list = itemsFor(v)}
					{@const current = v === view}
					<ul
						class="col-start-1 row-start-1 flex flex-nowrap items-center gap-1 normal-case tracking-normal {current
							? ''
							: 'invisible'}"
						inert={!current}
						aria-hidden={!current}
						onpointerleave={() => (preview = null)}
					>
						{#each list as segment (segment.name)}
							{#if segment.name === 'other'}
								<li
									class="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground whitespace-nowrap"
									title={otherNames}
								>
									<span class="size-2" style="background-color: {segment.color}"></span>
									other
									<span class="tabular-nums">{label(segment.value, v)}</span>
								</li>
							{:else}
								{@const active = language === segment.name}
								<li class="flex">
									<button
										type="button"
										aria-pressed={active}
										onclick={() => choose(segment.name)}
										onpointerenter={(e) => hover(e, segment.name)}
										onfocus={(e) => {
											if (e.currentTarget.matches(':focus-visible')) preview = segment.name;
										}}
										onblur={() => (preview = null)}
										class="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] whitespace-nowrap transition-colors {active
											? 'bg-secondary text-foreground'
											: focus && focus !== segment.name
												? 'text-foreground/45 hover:text-foreground hover:bg-secondary/60'
												: 'text-foreground/70 hover:text-foreground hover:bg-secondary/60'}"
									>
										<span class="size-2" style="background-color: {segment.color}"></span>
										{segment.name}
										<span class="text-muted-foreground tabular-nums">{label(segment.value, v)}</span>
									</button>
								</li>
							{/if}
						{/each}
					</ul>
				{/each}
			</div>
		</div>

		<!-- After the chips, not before them: here it appearing can't push the chips sideways, which
		     slid a different chip under the pointer the moment one was clicked. -->
		{#if language}
			<button
				type="button"
				onclick={() => (language = null)}
				aria-label="Clear the {language} filter"
				class="inline-flex shrink-0 items-center gap-1 text-foreground uppercase tracking-[0.3em] hover:text-primary transition-colors"
			>
				{language}<XIcon class="size-2.5 shrink-0" />
			</button>
			<span aria-hidden="true" class="h-4 w-px shrink-0 bg-rule"></span>
		{/if}

		{#if hasCode}
			<div class="flex shrink-0 items-center gap-2 max-sm:tracking-[0.15em]" role="group" aria-label="Weigh languages by">
				{#each ['projects', 'code'] as const as option, i (option)}
					{#if i > 0}<span aria-hidden="true" class="opacity-40">/</span>{/if}
					<button
						type="button"
						aria-pressed={view === option}
						onclick={() => switchView(option)}
						class="uppercase transition-colors {view === option ? 'text-foreground' : 'hover:text-foreground'}"
					>
						{option}
					</button>
				{/each}
			</div>
		{:else}
			<span class="shrink-0 tabular-nums">{items.length}</span>
		{/if}
	</div>

	<!-- The header's bottom edge, full width. It repeats the chips for the pointer, so it stays out
	     of the accessibility tree; the chips are the keyboard and screen-reader route to the same
	     filter. Keyed on the view so switching wipes the new proportions in rather than snapping.
	     The previewed or filtered language's segment drops down past the edge to mark it. -->
	{#key view}
		<div class="language-bar flex h-[3px] gap-px" aria-hidden="true" onpointerleave={() => (preview = null)}>
			{#each items as segment (segment.name)}
				{@const dimmed = focus && segment.name !== focus}
				{#if segment.name === 'other'}
					<span
						class="transition-opacity duration-300 {dimmed ? 'opacity-20' : ''}"
						style="flex: {segment.value} 1 0; background-color: {segment.color}"
						title="other: {otherNames}"
					></span>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions
					     (pointer shortcut for the chip buttons above, which carry the keyboard path) -->
					<span
						class="cursor-pointer origin-top transition-[opacity,scale,filter] duration-300 ease-out hover:brightness-110 {dimmed
							? 'opacity-20'
							: ''} {focus === segment.name ? 'scale-y-[2.5]' : ''}"
						style="flex: {segment.value} 1 0; background-color: {segment.color}"
						title="{segment.name} · {label(segment.value)}"
						onpointerenter={(e) => hover(e, segment.name)}
						onclick={() => choose(segment.name)}
					></span>
				{/if}
			{/each}
		</div>
	{/key}
</section>

<style>
	/* Fades the last visible chip into the toggle while more are scrolled out of view. */
	.chip-scroll.fade-end {
		mask-image: linear-gradient(to right, #000 calc(100% - 2.5rem), transparent);
	}

	/* Wipes in from the left on load and whenever the view changes (the {#key} remounts it). */
	.language-bar {
		animation: language-bar-in 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	@keyframes language-bar-in {
		from {
			clip-path: inset(0 100% 0 0);
		}
		to {
			clip-path: inset(0 0 0 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.language-bar {
			animation: none;
		}
		.language-bar > * {
			transition-duration: 0ms;
		}
	}
</style>
