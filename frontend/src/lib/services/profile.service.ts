import type { ApiResult, ServiceContext } from './contracts';
import { PROXY_ROUTES } from './contracts';
import { http } from './http';
import type { LinkListItemDTO } from './links.service';

type RequestContext = ServiceContext | string | undefined;

function resolveContext(ctx: RequestContext): ServiceContext | undefined {
	if (!ctx) {
		return undefined;
	}

	if (typeof ctx === 'string') {
		return { cookies: ctx };
	}

	return ctx;
}

export interface PublicProfileResponse {
	id: number;
	username: string;
	name: string | null;
	avatarUrl: string | null;
	bio: string | null;
	rank: string;
	stats: {
		totalLinks: number;
		totalLikes: number;
		totalViews: number;
	};
	links: LinkListItemDTO[];
}

export interface UpdateProfileInput {
	username?: string;
	bio?: string;
	avatarUrl?: string;
}

export interface UpdateProfileResponse {
	username: string;
	bio: string | null;
	avatarUrl: string | null;
}

export interface ChangePasswordInput {
	currentPassword: string;
	newPassword: string;
}

export class ProfileService {
	async getPublicProfile(username: string, ctx?: RequestContext): Promise<ApiResult<PublicProfileResponse>> {
		return http.get<PublicProfileResponse>(PROXY_ROUTES.users.byUsername(username), resolveContext(ctx));
	}

	async updateProfile(input: UpdateProfileInput, ctx?: RequestContext): Promise<ApiResult<UpdateProfileResponse>> {
		return http.put<UpdateProfileResponse>(PROXY_ROUTES.users.me, input, resolveContext(ctx));
	}

	async changePassword(input: ChangePasswordInput, ctx?: RequestContext): Promise<ApiResult<{ success: true }>> {
		return http.put<{ success: true }>(PROXY_ROUTES.users.changePassword, input, resolveContext(ctx));
	}
}

export const profileService = new ProfileService();
