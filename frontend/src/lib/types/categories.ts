/**
 * Category types for frontend
 */

export interface CategoryDTO {
	id: number;
	userId: number;
	name: string;
	color: string;
	linksCount?: number;
	createdAt: string;
}

export interface CreateCategoryInput {
	name: string;
	color?: string;
}

export interface UpdateCategoryInput {
	name?: string;
	color?: string;
}
