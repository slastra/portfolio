import { fetchRepos } from '$lib/github';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const result = await fetchRepos();
	return {
		repos: result.repos,
		fetchedAt: result.fetchedAt,
		error: result.error ?? null
	};
};
