<svelte:head>
	<title>OG Card</title>
</svelte:head>

<div class="og-frame relative overflow-hidden bg-background">
	<svg class="absolute inset-0 h-full w-full opacity-[0.18]" aria-hidden="true">
		<filter id="og-noise">
			<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
		</filter>
		<rect width="100%" height="100%" filter="url(#og-noise)" />
	</svg>

	<div class="absolute inset-0 pointer-events-none">
		<div class="absolute -top-[20%] -left-[10%] w-[60%] h-[80%] rounded-full bg-primary/20 blur-[140px]"></div>
		<div class="absolute -bottom-[20%] -right-[10%] w-[55%] h-[70%] rounded-full bg-iris/15 blur-[140px]"></div>
		<div class="absolute top-[30%] right-[25%] w-[35%] h-[45%] rounded-full bg-foam/10 blur-[120px]"></div>
	</div>

	<div class="relative h-full flex flex-col justify-between px-24 py-20">
		<div class="font-mono text-[18px] uppercase tracking-[0.4em] text-muted-foreground">
			index · MMXXVI
		</div>

		<div class="flex flex-col gap-8">
			<h1 class="font-heading font-black leading-[0.9] tracking-tight text-[180px]">
				<span class="text-foreground">dev</span><span class="text-primary">.</span><span class="text-foreground/70 italic font-normal">lastra.us</span>
			</h1>
			<p class="font-mono text-[22px] uppercase tracking-[0.3em] text-muted-foreground">
				public projects · pulled live from github
			</p>
		</div>

		<div class="font-mono text-[18px] uppercase tracking-[0.3em] text-muted-foreground">
			<span class="text-foreground/80">slastra</span> / portfolio
		</div>
	</div>
</div>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
	}
	.og-frame {
		width: 1200px;
		height: 630px;
	}
</style>
