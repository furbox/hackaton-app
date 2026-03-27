import type { PageServerLoad } from './$types';
import { categoriesService, linksService } from '$lib/services';

export const load: PageServerLoad = async ({ url, fetch, request }) => {
	const q = url.searchParams.get('q') || '';
	const sort = url.searchParams.get('sort') || 'recent';
	const categoryId = url.searchParams.get('categoryId');
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 12;

	try {
		const ctx = {
			fetch,
			cookies: request.headers.get('cookie') ?? undefined,
			signal: AbortSignal.timeout(5000)
		};

		const [linksResult, categoriesResult] = await Promise.all([
			linksService.getLinks({ sort, page, limit, ...(q ? { q } : {}), ...(categoryId ? { categoryId } : {}) }, ctx),
			categoriesService.getCategories(ctx)
		]);

		if (!linksResult.ok) {
			throw new Error(linksResult.error.message);
		}

		const links = Array.isArray(linksResult.data.items) ? linksResult.data.items : [];
		const categories = categoriesResult.ok ? categoriesResult.data : [];

		return {
			links,
			page: linksResult.data.page || page,
			limit: linksResult.data.limit || limit,
			total: linksResult.data.total || 0,
			sort,
			categories,
			query: q,
			categoryId: categoryId ? parseInt(categoryId) : null
		};
	} catch (error) {
		console.error('Error loading explore page:', error);
		return {
			links: [],
			page,
			limit,
			total: 0,
			sort,
			categories: [],
			query: q,
			categoryId: null
		};
	}
};
