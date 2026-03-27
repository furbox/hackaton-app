import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { profileService } from '$lib/services';

export const load: PageServerLoad = async ({ params, fetch, request }) => {
	const { username } = params;

	try {
		const response = await profileService.getPublicProfile(username, {
			fetch,
			cookies: request.headers.get('cookie') ?? undefined,
			signal: AbortSignal.timeout(5000)
		});

		if (!response.ok) {
			if (response.error.status === 404) {
				// User not found, redirect to explore with error
				throw redirect(302, '/explore?error=user_not_found');
			}
			throw new Error(`Failed to fetch user profile: ${response.error.status}`);
		}

		if (!response.data || typeof response.data !== 'object') {
			throw new Error('Invalid user data format from API');
		}

		return {
			user: response.data
		};
	} catch (error) {
		// If it's a redirect, throw it
		if (error && typeof error === 'object' && 'status' in error) {
			throw error;
		}

		console.error('Error loading user profile:', error);
		// Redirect to explore on error
		throw redirect(302, '/explore?error=profile_load_error');
	}
};
