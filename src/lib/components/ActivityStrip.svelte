<script lang="ts">
	import type { Activity } from '#lib/github.js';

	let { activity }: { activity: Activity } = $props();

	const weeks = $derived(activity.weeks);
	const max = $derived(Math.max(1, ...weeks.map((w) => w.count)));
	const latest = $derived(weeks[weeks.length - 1]);
	const busiest = $derived(weeks.reduce((a, w) => (w.count > a.count ? w : a), weeks[0]));

	let hovered = $state<number | null>(null);
	const shown = $derived(hovered === null ? null : weeks[hovered]);

	// Calendar dates (YYYY-MM-DD), so formatted in UTC: local time would shift them a day west.
	function day(date: string): string {
		return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}

	const number = (n: number) => n.toLocaleString('en-US');

	// The chart's text equivalent. The per-week values live in the hover tooltip and, in full,
	// on the GitHub profile the label links to.
	const summary = $derived(
		`${number(activity.total)} GitHub contributions in the last year. Busiest week ${day(busiest.start)} to ${day(busiest.end)} with ${number(busiest.count)}; ${number(latest.count)} in the last 7 days.`
	);
</script>

<!-- A single-series emphasis column strip: every rolling week in the de-emphasis ink, the newest
     in the accent, all on one shared midline. No legend (one series; the label names it) and one
     direct label, the newest week's value, which also gives the light theme's accent the
     visible-label relief it needs (it sits under 3:1 on Dawn's paper). The side columns are equal
     widths so the bars themselves, not the strip as a whole, sit on the header's centre line. -->
<div
	class="grid grid-cols-[12rem_auto_12rem] items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
>
	<a
		href="https://github.com/slastra"
		target="_blank"
		rel="noopener noreferrer"
		class="justify-self-end whitespace-nowrap hover:text-foreground transition-colors"
	>
		activity<span class="px-1.5 opacity-40">·</span><span class="tabular-nums">{number(activity.total)}</span> / yr
	</a>

	<div class="relative">
		<div
			role="img"
			aria-label={summary}
			class="activity-bars flex h-6 items-center"
			onpointerleave={() => (hovered = null)}
		>
			{#each weeks as week, i (week.start)}
				<!-- The hit area is the whole column, gap included, so a 4px bar isn't a pinpoint. -->
				<span
					class="flex h-full items-center px-px"
					onpointerenter={() => (hovered = i)}
					aria-hidden="true"
				>
					<span
						class="bar block w-1 transition-colors duration-150 {i === weeks.length - 1
							? 'bg-primary'
							: hovered === i
								? 'bg-foreground'
								: 'bar-ink'}"
						style:height="{Math.max(1, (week.count / max) * 24)}px"
						style:animation-delay="{i * 8}ms"
					></span>
				</span>
			{/each}
		</div>

		{#if shown && hovered !== null}
			<!-- Value first and strong, the period after it: the reader already knows the series. -->
			<div
				class="pointer-events-none absolute top-full z-40 mt-2 -translate-x-1/2 whitespace-nowrap border border-rule bg-popover px-2 py-1 normal-case tracking-normal text-[11px] text-muted-foreground shadow-lg"
				style:left="{(hovered + 0.5) * 6}px"
			>
				<span class="font-semibold text-foreground tabular-nums">{number(shown.count)}</span>
				{shown.count === 1 ? 'contribution' : 'contributions'} · {day(shown.start)} – {day(shown.end)}
			</div>
		{/if}
	</div>

	<span class="justify-self-start whitespace-nowrap tabular-nums">
		<span class="text-foreground/80">{number(latest.count)}</span> last 7 days
	</span>
</div>

<style>
	/* Dark: Rosé Pine's muted. Dawn: its subtle, one step deeper, since muted fails 3:1 on paper
	   and sits too close to the accent (checked with the dataviz palette validator). */
	.bar-ink {
		background-color: var(--activity-ink);
	}

	/* Centred on a midline, waveform-style, and grown out from it on load in a quick
	   left-to-right run. An empty week is a 1px tick on the line. */
	.bar {
		transform-origin: center;
		animation: activity-grow 500ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	@keyframes activity-grow {
		from {
			transform: scaleY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation: none;
		}
	}
</style>
