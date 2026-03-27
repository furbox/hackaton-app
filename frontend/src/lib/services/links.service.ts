import type { ApiResult, ServiceContext } from './contracts';
import { PROXY_ROUTES } from './contracts';
import { http } from './http';

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

function toQueryString(params: Record<string, unknown> = {}): string {
	const query = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			query.append(key, String(value));
		}
	});

	const queryString = query.toString();
	return queryString ? `?${queryString}` : '';
}

export interface LinkDTO {
	id: number;
	userId: number;
	url: string;
	title: string;
	description: string | null;
	shortCode: string;
	isPublic: boolean;
	categoryId: number | null;
	views: number;
	createdAt: string;
}

export interface LinkListItemDTO extends LinkDTO {
	likesCount: number;
	favoritesCount: number;
	likedByMe?: boolean;
	favoritedByMe?: boolean;
	owner?: {
		id: number;
		username: string;
		avatarUrl: string | null;
	};
	category?: {
		id: number;
		name: string;
		color: string;
	} | null;
}

export interface GetLinksOutput {
	items: LinkListItemDTO[];
	page: number;
	limit: number;
	sort: string;
	total?: number;
}

// DTOs for public pages
export interface GlobalStatsDTO {
	totalUsers: number;
	totalLinks: number;
	totalCategories: number;
}

export interface TopUserDTO {
	id: number;
	username: string;
	avatarUrl: string | null;
	rank: string;
	linkCount: number;
}

export interface CreateLinkInput {
	url: string;
	title: string;
	description?: string | null;
	shortCode: string;
	isPublic?: boolean;
	categoryId?: number | null;
}

export interface UpdateLinkInput {
	url?: string;
	title?: string;
	description?: string | null;
	isPublic?: boolean;
	categoryId?: number | null;
}

export class LinksService {
	async getLinks(params: Record<string, unknown> = {}, ctx?: RequestContext): Promise<ApiResult<GetLinksOutput>> {
		return http.get<GetLinksOutput>(`${PROXY_ROUTES.links.list}${toQueryString(params)}`, resolveContext(ctx));
	}

	async getMyLinks(params: Record<string, unknown> = {}, ctx?: RequestContext): Promise<ApiResult<GetLinksOutput>> {
		return http.get<GetLinksOutput>(`${PROXY_ROUTES.links.me}${toQueryString(params)}`, resolveContext(ctx));
	}

	async getLink(id: number, ctx?: RequestContext): Promise<ApiResult<LinkDTO>> {
		return http.get<LinkDTO>(PROXY_ROUTES.links.byId(id), resolveContext(ctx));
	}

	async createLink(input: CreateLinkInput, ctx?: RequestContext): Promise<ApiResult<LinkDTO>> {
		return http.post<LinkDTO>(PROXY_ROUTES.links.list, input, resolveContext(ctx));
	}

	async updateLink(id: number, input: UpdateLinkInput, ctx?: RequestContext): Promise<ApiResult<LinkDTO>> {
		return http.put<LinkDTO>(PROXY_ROUTES.links.byId(id), input, resolveContext(ctx));
	}

	async deleteLink(id: number, ctx?: RequestContext): Promise<ApiResult<{ deleted: true }>> {
		return http.delete<{ deleted: true }>(PROXY_ROUTES.links.byId(id), resolveContext(ctx));
	}

	async toggleLike(id: number, ctx?: RequestContext): Promise<ApiResult<unknown>> {
		return http.post<unknown>(PROXY_ROUTES.links.like(id), {}, resolveContext(ctx));
	}

	async toggleFavorite(id: number, ctx?: RequestContext): Promise<ApiResult<unknown>> {
		return http.post<unknown>(PROXY_ROUTES.links.favorite(id), {}, resolveContext(ctx));
	}

	async previewLink(url: string, ctx?: RequestContext): Promise<ApiResult<unknown>> {
		return http.post<unknown>(PROXY_ROUTES.links.preview, { url }, resolveContext(ctx));
	}
}

export const linksService = new LinksService();
