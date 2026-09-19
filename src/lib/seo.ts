import type { Repo } from './github';

export const SITE_URL = 'https://dev.lastra.us';
export const SITE_NAME = 'dev.lastra.us';

export const PERSON = {
	name: 'Shaun Lastra',
	givenName: 'Shaun',
	familyName: 'Lastra',
	// Mirrors the GitHub profile bio; keep the two in sync so the entity reads the same everywhere.
	description:
		'Software developer. Builds operations and commerce tools for the liquidation industry, Linux desktop and CLI utilities, and Nuxt and Svelte apps.',
	jobTitle: 'Software Developer',
	image: 'https://avatars.githubusercontent.com/u/34750676?v=4',
	// Every public profile that is unambiguously the same person. Search engines reconcile the
	// entity across these, which is what lets a personal site outrank a people-search listing.
	sameAs: [
		'https://github.com/slastra',
		'https://aur.archlinux.org/account/slastra',
		'https://chromewebstore.google.com/detail/tabctl/baomblllgemcgbignhpbipgiofmjdhpn'
	]
} as const;

export const PAGE_TITLE = `${PERSON.name} — ${SITE_NAME}`;
export const PAGE_DESCRIPTION = `${PERSON.name}'s open-source projects: ${PERSON.description.replace(/^Software developer\. Builds /, '')} A live index pulled from GitHub.`;

const PERSON_ID = `${SITE_URL}/#person`;
const SITE_ID = `${SITE_URL}/#website`;
const PAGE_ID = `${SITE_URL}/#profilepage`;
const LIST_ID = `${SITE_URL}/#projects`;

function repoNode(repo: Repo) {
	const node: Record<string, unknown> = {
		'@type': 'SoftwareSourceCode',
		'@id': repo.html_url,
		name: repo.name,
		codeRepository: repo.html_url,
		url: repo.homepage || repo.html_url,
		dateModified: repo.pushed_at,
		author: { '@id': PERSON_ID },
		isAccessibleForFree: true
	};
	if (repo.description) node.description = repo.description;
	if (repo.language) node.programmingLanguage = repo.language;
	if (repo.media?.image) node.image = repo.media.image;
	return node;
}

/**
 * One @graph for the index page. The Person is the entity we want search engines to attach the
 * name query to; the WebSite and ProfilePage point back at it, and every visible card is a
 * SoftwareSourceCode with the Person as author.
 */
export function buildJsonLd(repos: Repo[], fetchedAt: number) {
	const languages = [...new Set(repos.map((r) => r.language).filter((l): l is string => !!l))];

	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Person',
				'@id': PERSON_ID,
				name: PERSON.name,
				givenName: PERSON.givenName,
				familyName: PERSON.familyName,
				description: PERSON.description,
				jobTitle: PERSON.jobTitle,
				image: PERSON.image,
				url: `${SITE_URL}/`,
				mainEntityOfPage: { '@id': PAGE_ID },
				sameAs: PERSON.sameAs,
				knowsAbout: languages
			},
			{
				'@type': 'WebSite',
				'@id': SITE_ID,
				name: SITE_NAME,
				alternateName: PERSON.name,
				url: `${SITE_URL}/`,
				description: PAGE_DESCRIPTION,
				inLanguage: 'en',
				author: { '@id': PERSON_ID },
				publisher: { '@id': PERSON_ID }
			},
			{
				'@type': 'ProfilePage',
				'@id': PAGE_ID,
				url: `${SITE_URL}/`,
				name: PAGE_TITLE,
				description: PAGE_DESCRIPTION,
				inLanguage: 'en',
				isPartOf: { '@id': SITE_ID },
				about: { '@id': PERSON_ID },
				mainEntity: { '@id': PERSON_ID },
				hasPart: { '@id': LIST_ID },
				dateModified: new Date(fetchedAt).toISOString(),
				primaryImageOfPage: {
					'@type': 'ImageObject',
					url: `${SITE_URL}/og.png`,
					width: 1200,
					height: 630
				}
			},
			{
				'@type': 'ItemList',
				'@id': LIST_ID,
				name: `Public projects by ${PERSON.name}`,
				numberOfItems: repos.length,
				itemListOrder: 'https://schema.org/ItemListUnordered',
				itemListElement: repos.map((repo, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					item: repoNode(repo)
				}))
			}
		]
	};
}

/** Serialise for an inline <script>: a `</script>` inside a repo description must not end the tag. */
export function jsonLdScript(data: unknown): string {
	const json = JSON.stringify(data).replace(/</g, '\\u003c');
	return `<script type="application/ld+json">${json}</script>`;
}
