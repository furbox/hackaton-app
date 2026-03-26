import { http, type ApiResponse } from './http';

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
}

export interface GetLinksOutput {
	items: LinkListItemDTO[];
	page: number;
	limit: number;
	sort: string;
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
	async getLinks(params: Record<string, any> = {}, cookies?: string): Promise<ApiResponse<GetLinksOutput>> {
		const query = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				query.append(key, value.toString());
			}
		});
		const queryString = query.toString();
		return http.get<GetLinksOutput>(`/api/links${queryString ? `?${queryString}` : ''}`, { cookies });
	}

	async getMyLinks(params: Record<string, any> = {}, cookies?: string): Promise<ApiResponse<GetLinksOutput>> {
		const query = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				query.append(key, value.toString());
			}
		});
		const queryString = query.toString();
		return http.get<GetLinksOutput>(`/api/links/me${queryString ? `?${queryString}` : ''}`, { cookies });
	}

	async getLink(id: number, cookies?: string): Promise<ApiResponse<LinkDTO>> {
		return http.get<LinkDTO>(`/api/links/${id}`, { cookies });
	}

	async createLink(input: CreateLinkInput, cookies?: string): Promise<ApiResponse<LinkDTO>> {
		return http.post<LinkDTO>('/api/links', input, { cookies });
	}

	async updateLink(id: number, input: UpdateLinkInput, cookies?: string): Promise<ApiResponse<LinkDTO>> {
		return http.put<LinkDTO>(`/api/links/${id}`, input, { cookies });
	}

	async deleteLink(id: number, cookies?: string): Promise<ApiResponse<{ deleted: true }>> {
		return http.delete<{ deleted: true }>(`/api/links/${id}`, { cookies });
	}

	async toggleLike(id: number, cookies?: string): Promise<ApiResponse<any>> {
		return http.post<any>(`/api/links/${id}/like`, {}, { cookies });
	}

	async toggleFavorite(id: number, cookies?: string): Promise<ApiResponse<any>> {
		return http.post<any>(`/api/links/${id}/favorite`, {}, { cookies });
	}

	async previewLink(url: string, cookies?: string): Promise<ApiResponse<any>> {
		return http.post<any>('/api/links/preview', { url }, { cookies });
	}
}

export const linksService = new LinksService();
