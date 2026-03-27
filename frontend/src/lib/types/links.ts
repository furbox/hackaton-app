/**
 * Link types for frontend
 */

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
	ogTitle?: string | null;
	ogDescription?: string | null;
	ogImage?: string | null;
	statusCode?: number;
	archiveUrl?: string | null;
	contentText?: string | null;
}

export interface LinkListItemDTO extends LinkDTO {
	likesCount: number;
	favoritesCount: number;
	likedByMe?: boolean;
	favoritedByMe?: boolean;
	owner?: {
		id: number;
		username: string;
		avatar_url?: string;
	};
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
