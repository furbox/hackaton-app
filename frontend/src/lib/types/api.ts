/**
 * API DTOs for public endpoints
 */
import type { LinkListItemDTO } from '../services/links.service';

export interface GlobalStatsDTO {
	users: number;
	links: number;
	categories: number;
}

export interface TopUserDTO {
	id: number;
	username: string;
	avatar_url?: string;
	rank: string;
	linksCount: number;
	likesReceived: number;
}

export interface PublicUserDTO {
	id: number;
	username: string;
	name: string;
	avatar_url?: string;
	bio?: string;
	rank: string;
	linksCount: number;
	likesReceived: number;
	viewsTotal: number;
	links: LinkListItemDTO[];
}

export interface HomeLoadData {
	stats: GlobalStatsDTO;
	featuredLinks: LinkListItemDTO[];
}

export interface ExploreLoadData {
	links: LinkListItemDTO[];
	page: number;
	limit: number;
	sort: string;
	total?: number;
}

export interface ProfileLoadData {
	user: PublicUserDTO;
}

export interface CategoryDTO {
	id: number;
	userId: number;
	name: string;
	color: string;
	linksCount?: number;
}

// Re-export from other modules for convenience
export type { LinkListItemDTO } from '../services/links.service';
export type { CategoryDTO as CategoryDetailDTO } from './categories';
