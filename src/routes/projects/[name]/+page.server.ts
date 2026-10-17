import { findProjectInList } from '#lib/project.server.js';
import { getReadme } from '#lib/readme.server.js';
import { PERSON, summarize } from '#lib/seo.js';
import type { PageServerLoad } from './$types';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const load: PageServerLoad = async ({ params }) => {
	const { repo, prev, next } = await findProjectInList(params.name);

	// A GitHub hiccup costs the readme, not the page: the metadata is already cached.
	const readme = await getReadme(repo).catch(() => null);

	const summary =
		repo.description ||
		(readme?.text ? summarize(readme.text) : `${repo.name}, an open-source project by ${PERSON.name}.`);

	// The banner comes from the repo's screenshot.* / demo.*, which most READMEs already embed
	// (sometimes as demo.gif next to the demo.mp4 the banner picked). Showing both stacks the same
	// picture twice, so the banner only appears when the README doesn't carry it.
	const ownMedia = new RegExp(
		`/slastra/${escapeRegExp(repo.name)}(?:/|@)[\\w.-]+/(?:docs/)?(?:screenshot|demo)\\.`,
		'i'
	);
	const showBanner = !!repo.media && !(readme?.html && ownMedia.test(readme.html));

	return { repo, readme: readme?.html ?? null, summary, showBanner, prev, next };
};
