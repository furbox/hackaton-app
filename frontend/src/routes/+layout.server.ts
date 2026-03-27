import type { LayoutServerLoad } from './$types';

/**
 * Load session data for all pages.
 * This runs on the server for every page navigation.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		session: locals.session || null
	};
};
