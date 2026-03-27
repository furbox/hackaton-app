import type { PageServerLoad } from './$types';
import { linksService, statsService } from '$lib/services';

export const load: PageServerLoad = async ({ fetch, request }) => {
	try {
		const ctx = {
			fetch,
			cookies: request.headers.get('cookie') ?? undefined,
			signal: AbortSignal.timeout(5000)
		};

		const statsPromise = statsService.getGlobalStats(ctx);
		const featuredPromise = linksService.getLinks({ sort: 'likes', limit: 6 }, ctx);
		const topUsersPromise = linksService.getLinks({ sort: 'likes', limit: 50 }, ctx);

		const [statsResult, featuredResult, linksResult] = await Promise.all([
			statsPromise,
			featuredPromise,
			topUsersPromise
		]);

		if (!statsResult.ok || !featuredResult.ok || !linksResult.ok) {
			throw new Error('Failed to load home page data');
		}

		// Extract unique users from links and count their links
		const userMap = new Map<number, any>();
		const links = Array.isArray(linksResult.data.items) ? linksResult.data.items : [];

		links.forEach((link: any) => {
			if (link.owner) {
				const existing = userMap.get(link.owner.id);
				if (existing) {
					existing.linkCount++;
				} else {
					userMap.set(link.owner.id, {
						id: link.owner.id,
						username: link.owner.username,
						avatarUrl: link.owner.avatarUrl,
						rank: 'newbie', // Default rank, ideally fetched from user endpoint
						linkCount: 1
					});
				}
			}
		});

		const topUsers = Array.from(userMap.values())
			.sort((a, b) => b.linkCount - a.linkCount)
			.slice(0, 10);

		return {
			stats: statsResult.data ?? { totalUsers: 0, totalLinks: 0, totalCategories: 0 },
			featuredLinks: featuredResult.data?.items ?? [],
			topUsers
		};
	} catch (error) {
		console.error('Error loading home page data:', error);
		// Return empty data on error to prevent page from breaking
		return {
			stats: { totalUsers: 0, totalLinks: 0, totalCategories: 0 },
			featuredLinks: [],
			topUsers: []
		};
	}
};
