// See https://svelte.dev/docs/kit/types#app
import type { Repo } from '#lib/github.js';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** Set by RepoCard's shallow navigation to /projects/<name>; drives the index's modal. */
			project?: { repo: Repo; readme: string | null };
		}
		// interface Platform {}
	}
}

export {};
