import { http, type ApiResponse } from './http';

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
	async getCategories(cookies?: string): Promise<ApiResponse<CategoryWithLinksCountDTO[]>> {
		return http.get<CategoryWithLinksCountDTO[]>('/api/categories', { cookies });
	}

	async createCategory(input: CreateCategoryInput, cookies?: string): Promise<ApiResponse<CategoryDTO>> {
		return http.post<CategoryDTO>('/api/categories', input, { cookies });
	}

	async updateCategory(id: number, input: UpdateCategoryInput, cookies?: string): Promise<ApiResponse<CategoryDTO>> {
		return http.put<CategoryDTO>(`/api/categories/${id}`, input, { cookies });
	}

	async deleteCategory(id: number, cookies?: string): Promise<ApiResponse<{ deleted: true }>> {
		return http.delete<{ deleted: true }>(`/api/categories/${id}`, { cookies });
	}
}

export const categoriesService = new CategoriesService();
