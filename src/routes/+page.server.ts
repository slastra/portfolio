import { fetchRepos } from '#lib/github.server.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const result = await fetchRepos();
	return {
		repos: result.repos,
		fetchedAt: result.fetchedAt,
		activity: result.activity,
		error: result.error ?? null
	};
};
