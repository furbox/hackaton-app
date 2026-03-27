import { authService } from './auth.service';
import { categoriesService } from './categories.service';
import { linksService, type LinkListItemDTO } from './links.service';
import { profileService } from './profile.service';
import { statsService } from './stats.service';

function unwrapOrThrow<T>(result: { ok: true; data: T } | { ok: false; error: { message: string; status: number } }): T {
	if (!result.ok) {
		if (result.error.status === 404) {
			throw new Error('NOT_FOUND');
		}

		throw new Error(result.error.message);
	}

	return result.data;
}

export class PublicApiClient {
	async getGlobalStats() {
		return unwrapOrThrow(await statsService.getGlobalStats());
	}

	async getLinks(params: {
		q?: string;
		categoryId?: number;
		sort?: 'recent' | 'likes' | 'views' | 'favorites';
		page?: number;
		limit?: number;
	}): Promise<{ items: LinkListItemDTO[]; page: number; limit: number; sort: string; total?: number }> {
		return unwrapOrThrow(await linksService.getLinks(params));
	}

	async getUserProfile(username: string) {
		return unwrapOrThrow(await profileService.getPublicProfile(username));
	}

	async verifyEmail(token: string): Promise<{ success: boolean; message?: string }> {
		return unwrapOrThrow(await authService.verifyEmail(token));
	}

	async getPublicCategories(): Promise<Array<{ id: number; name: string; color: string }>> {
		return unwrapOrThrow(await categoriesService.getCategories());
	}
}

export const publicApi = new PublicApiClient();
