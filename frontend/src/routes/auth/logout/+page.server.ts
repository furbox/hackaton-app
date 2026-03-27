import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { authService } from '$lib/services';

export const load: PageServerLoad = async () => {
	throw redirect(302, '/');
};

export const actions: Actions = {
	default: async ({ fetch, cookies, request }) => {
		try {
			await authService.logout({
				fetch,
				cookies: request.headers.get('cookie') ?? undefined,
				signal: AbortSignal.timeout(5000)
			});

			cookies.delete('session', { path: '/' });
			throw redirect(303, '/');
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error) {
				throw error;
			}

			console.error('Logout error:', error);
			cookies.delete('session', { path: '/' });
			throw redirect(303, '/');
		}
	}
};
