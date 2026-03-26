import { fail, type Actions } from '@sveltejs/kit';
import { profileService } from '$lib/services/profile.service';

export const actions: Actions = {
	updateProfile: async ({ request }) => {
		const formData = await request.formData();
		const username = formData.get('username')?.toString();
		const bio = formData.get('bio')?.toString();
		const avatarUrl = formData.get('avatarUrl')?.toString();

		const response = await profileService.updateProfile(
			{ username, bio, avatarUrl },
			request.headers.get('cookie') ?? undefined
		);

		if (!response.ok) {
			return fail(response.status, {
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
