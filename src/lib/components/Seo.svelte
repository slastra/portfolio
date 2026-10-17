<script lang="ts">
	import type { Snippet } from 'svelte';
	import { jsonLdScript, PERSON, SITE_NAME, SITE_URL } from '#lib/seo.js';

	interface Props {
		title: string;
		description: string;
		/** Site-relative path of the canonical URL, e.g. `/` or `/projects/hyprglaze`. */
		path: string;
		/** Absolute URL of a 1200×630 image. */
		image: string;
		imageAlt: string;
		ogType?: 'website' | 'profile';
		jsonLd: unknown;
		/** Page-specific tags that don't belong on every page (profile:*, rel="me"). */
		children?: Snippet;
	}

	let { title, description, path, image, imageAlt, ogType = 'website', jsonLd, children }: Props =
		$props();

	const url = $derived(`${SITE_URL}${path}`);
	const ld = $derived(jsonLdScript(jsonLd));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="author" content={PERSON.name} />
	<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
	<link rel="canonical" href={url} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content={ogType} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={imageAlt} />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
	<meta name="twitter:image:alt" content={imageAlt} />
	{@render children?.()}
	{@html ld}
</svelte:head>
