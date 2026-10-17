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

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og.png`;

export function projectPath(name: string): string {
	return `/projects/${encodeURIComponent(name)}`;
}

export function projectUrl(name: string): string {
	return `${SITE_URL}${projectPath(name)}`;
}

export function projectOgImage(name: string): string {
	return `${projectUrl(name)}/og.png`;
}

/** First ~155 characters, cut at a word boundary: the length search results show before truncating. */
export function summarize(text: string, max = 155): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	const space = cut.lastIndexOf(' ');
	return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/**
 * The slim Person every project page carries. Crawlers read each page on its own, so a page that
 * only pointed at `#person` would leave the author unnamed; repeating the @id with the identifying
 * fields lets the entity merge with the full node on the index.
 */
function personRef() {
	return {
		'@type': 'Person',
		'@id': PERSON_ID,
		name: PERSON.name,
		url: `${SITE_URL}/`,
		sameAs: PERSON.sameAs
	};
}

function repoNode(repo: Repo) {
	const node: Record<string, unknown> = {
		'@type': 'SoftwareSourceCode',
		// The GitHub URL rather than the project page, so the index's list entry and the project
		// page's main entity are recognisably the same thing.
		'@id': repo.html_url,
		name: repo.name,
		codeRepository: repo.html_url,
		url: projectUrl(repo.name),
		sameAs: repo.homepage ? [repo.html_url, repo.homepage] : [repo.html_url],
		dateCreated: repo.created_at,
		dateModified: repo.pushed_at,
		author: { '@id': PERSON_ID },
		isAccessibleForFree: true
	};
	if (repo.description) node.description = repo.description;
	if (repo.language) node.programmingLanguage = repo.language;
	if (repo.topics.length) node.keywords = repo.topics.join(', ');
	if (repo.license) node.license = `https://spdx.org/licenses/${repo.license}`;
	if (repo.media?.image) node.image = repo.media.image;
	if (repo.archived) node.creativeWorkStatus = 'Archived';
	return node;
}

/**
 * One @graph for the index page. The Person is the entity we want search engines to attach the
 * name query to; the WebSite and ProfilePage point back at it, and every visible card is a
 * SoftwareSourceCode with the Person as author. Each list item carries its project page's URL,
 * which is the summary-page pattern Google reads as a list of detail pages.
 */
export function buildJsonLd(repos: Repo[], fetchedAt: number) {
	const languages = [...new Set(repos.map((r) => r.language).filter((l): l is string => !!l))];

	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				...personRef(),
				givenName: PERSON.givenName,
				familyName: PERSON.familyName,
				description: PERSON.description,
				jobTitle: PERSON.jobTitle,
				image: PERSON.image,
				mainEntityOfPage: { '@id': PAGE_ID },
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
					url: DEFAULT_OG_IMAGE,
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
					url: projectUrl(repo.name),
					item: repoNode(repo)
				}))
			}
		]
	};
}

/** The @graph for /projects/<name>: the page, its breadcrumb, and the repo as its main entity. */
export function buildProjectJsonLd(repo: Repo, description: string) {
	const url = projectUrl(repo.name);
	const pageId = `${url}#webpage`;
	const crumbsId = `${url}#breadcrumb`;

	return {
		'@context': 'https://schema.org',
		'@graph': [
			personRef(),
			{ '@type': 'WebSite', '@id': SITE_ID, name: SITE_NAME, url: `${SITE_URL}/` },
			{
				'@type': 'ItemPage',
				'@id': pageId,
				url,
				name: projectTitle(repo.name),
				description,
				inLanguage: 'en',
				isPartOf: { '@id': SITE_ID },
				author: { '@id': PERSON_ID },
				breadcrumb: { '@id': crumbsId },
				mainEntity: { '@id': repo.html_url },
				dateModified: repo.pushed_at,
				primaryImageOfPage: {
					'@type': 'ImageObject',
					url: projectOgImage(repo.name),
					width: 1200,
					height: 630
				}
			},
			{
				'@type': 'BreadcrumbList',
				'@id': crumbsId,
				itemListElement: [
					// Named for the person rather than the site, so every project page points home
					// with the name as its anchor.
					{ '@type': 'ListItem', position: 1, name: PERSON.name, item: `${SITE_URL}/` },
					{ '@type': 'ListItem', position: 2, name: repo.name, item: url }
				]
			},
			{ ...repoNode(repo), mainEntityOfPage: { '@id': pageId } }
		]
	};
}

/**
 * The name stays out of project titles on purpose: the index is the page meant to answer a search
 * for the name (it ranks #1), and 31 pages titled "<project> — <name>" would compete with it.
 * Authorship is still carried by the shared Person @id and the breadcrumb.
 */
export function projectTitle(name: string): string {
	return `${name} — ${SITE_NAME}`;
}

/** Serialise for an inline <script>: a `</script>` inside a repo description must not end the tag. */
export function jsonLdScript(data: unknown): string {
	const json = JSON.stringify(data).replace(/</g, '\\u003c');
	return `<script type="application/ld+json">${json}</script>`;
}
