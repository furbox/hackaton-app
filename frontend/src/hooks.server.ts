import type { Handle } from '@sveltejs/kit';
import { authService } from '$lib/services/auth.service';

/**
 * Session handler that runs on every server-side request.
 * Fetches session data from backend and populates event.locals.session.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const cookieHeader = event.request.headers.get('cookie');

	// Fetch session from backend if cookies exist
	let session = null;
	if (cookieHeader) {
		try {
			const response = await authService.getSession({
				fetch: event.fetch,
				cookies: cookieHeader,
				signal: AbortSignal.timeout(3000)
			});

			if (response.ok) {
				session = response.data;
			}
		} catch (error) {
			// If session fetch fails, continue without session
			console.error('Failed to fetch session:', error);
		}
	}

	// Set session in locals for access in load functions
	event.locals.session = session;

	// Continue with the request
	return resolve(event);
};
