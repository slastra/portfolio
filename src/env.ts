import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	GITHUB_TOKEN: {
		description:
			'Optional GitHub PAT with public-repo read scope. Raises the REST budget from 60 to 5000 requests/hour and enables card banners (GraphQL needs a token).',
		// Read at startup, not inlined. Unset means anonymous, so fall back to '' rather than failing.
		schema: (input) => input ?? ''
	}
});
