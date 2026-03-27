import { fail, type Actions } from '@sveltejs/kit';
import { categoriesService } from '$lib/services';

export const actions: Actions = {
	createCategory: async ({ request, fetch }) => {
		const formData = await request.formData();
		const name = formData.get('name')?.toString();
		const color = formData.get('color')?.toString() ?? '#6366f1';

		if (!name) {
			return fail(400, {
				success: false,
				formError: 'Name is required',
				data: { name, color }
			});
		}

		const response = await categoriesService.createCategory(
			{ name, color },
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
				data: { name, color }
			});
		}

		return {
			success: true,
			data: response.data
		};
	}
};
