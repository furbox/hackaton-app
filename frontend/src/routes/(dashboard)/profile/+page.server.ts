import { fail, type Actions } from '@sveltejs/kit';
import { profileService } from '$lib/services';

export const actions: Actions = {
	updateProfile: async ({ request, fetch }) => {
		const formData = await request.formData();
		const username = formData.get('username')?.toString();
		const bio = formData.get('bio')?.toString();
		const avatarUrl = formData.get('avatarUrl')?.toString();

		const response = await profileService.updateProfile(
			{ username, bio, avatarUrl },
			{
				fetch,
				cookies: request.headers.get('cookie') ?? undefined,
				signal: AbortSignal.timeout(5000)
			}
		);

		if (!response.ok) {
			return fail(response.error.status, {
				success: false,
				formError: response.error.message,
				fieldErrors: response.error.details,
				data: { username, bio, avatarUrl }
			});
		}

		return {
			success: true,
			data: response.data
		};
	}
};
