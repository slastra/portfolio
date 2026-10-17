import { error, redirect } from '@sveltejs/kit';
import { fetchRepos } from './github.server';
import { projectPath } from './seo';
import type { Repo } from './github';

/**
 * The repo a /projects/<name> URL refers to. GitHub names are case-insensitive, so a
 * differently-cased URL redirects to the canonical one rather than splitting into duplicates.
 */
export async function findProject(name: string, suffix = ''): Promise<Repo> {
	return (await findProjectInList(name, suffix)).repo;
}

export type ProjectLink = { name: string; description: string | null };

/** As findProject, plus the projects either side of it in index order, for prev/next links. */
export async function findProjectInList(
	name: string,
	suffix = ''
): Promise<{ repo: Repo; prev: ProjectLink | null; next: ProjectLink | null }> {
	const { repos } = await fetchRepos();
	const i = repos.findIndex((r) => r.name.toLowerCase() === name.toLowerCase());
	if (i === -1) error(404, 'Unknown project');
	const repo = repos[i];
	if (repo.name !== name) redirect(308, `${projectPath(repo.name)}${suffix}`);

	const link = (r: Repo | undefined): ProjectLink | null =>
		r ? { name: r.name, description: r.description } : null;
	return { repo, prev: link(repos[i - 1]), next: link(repos[i + 1]) };
}
