import { fail, type Actions } from '@sveltejs/kit';
import { linksService } from '$lib/services';

export const actions: Actions = {
	createLink: async ({ request, fetch }) => {
		const formData = await request.formData();
		const url = formData.get('url')?.toString();
		const title = formData.get('title')?.toString();
		const description = formData.get('description')?.toString();
		const shortCode = formData.get('shortCode')?.toString();
		const categoryId = formData.get('categoryId')?.toString();
		const isPublic = formData.get('isPublic') === 'true';

		if (!url || !title || !shortCode) {
			return fail(400, {
				success: false,
				formError: 'URL, Title and Short Code are required',
				data: { url, title, description, shortCode, categoryId, isPublic }
			});
		}

		const response = await linksService.createLink(
			{
				url,
				title,
				description,
				shortCode,
				isPublic,
				categoryId: categoryId ? parseInt(categoryId) : null
			},
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
				data: { url, title, description, shortCode, categoryId, isPublic }
			});
		}

		return {
			success: true,
			data: response.data
		};
	}
};
