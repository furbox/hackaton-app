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

export interface CategoryDTO {
	id: number;
	userId: number;
	name: string;
	color: string;
}

export interface CategoryWithLinksCountDTO extends CategoryDTO {
	linksCount: number;
}

export interface CreateCategoryInput {
	name: string;
	color: string;
}

export interface UpdateCategoryInput {
	name?: string;
	color?: string;
}

export class CategoriesService {
	async getCategories(ctx?: RequestContext): Promise<ApiResult<CategoryWithLinksCountDTO[]>> {
		return http.get<CategoryWithLinksCountDTO[]>(PROXY_ROUTES.categories.list, resolveContext(ctx));
	}

	async createCategory(input: CreateCategoryInput, ctx?: RequestContext): Promise<ApiResult<CategoryDTO>> {
		return http.post<CategoryDTO>(PROXY_ROUTES.categories.list, input, resolveContext(ctx));
	}

	async updateCategory(id: number, input: UpdateCategoryInput, ctx?: RequestContext): Promise<ApiResult<CategoryDTO>> {
		return http.put<CategoryDTO>(PROXY_ROUTES.categories.byId(id), input, resolveContext(ctx));
	}

	async deleteCategory(id: number, ctx?: RequestContext): Promise<ApiResult<{ deleted: true }>> {
		return http.delete<{ deleted: true }>(PROXY_ROUTES.categories.byId(id), resolveContext(ctx));
	}
}

export const categoriesService = new CategoriesService();
