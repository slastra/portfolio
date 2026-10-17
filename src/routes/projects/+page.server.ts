import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The project list is the index; this keeps the breadcrumb's middle segment from being a 404.
export const load: PageServerLoad = () => {
	redirect(308, '/');
};
