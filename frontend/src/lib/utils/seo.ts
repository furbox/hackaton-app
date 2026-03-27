/**
 * SEO Metadata Helper Utilities
 *
 * Provides helper functions for generating SEO metadata
 * for SvelteKit pages (title, description, Open Graph tags)
 */

export interface SEOConfig {
	title: string;
	description: string;
	image?: string;
	url?: string;
	type?: 'website' | 'article' | 'profile';
	siteName?: string;
	twitterHandle?: string;
	noIndex?: boolean;
}

/**
 * Default site configuration
 */
const DEFAULT_SITE_NAME = 'URLoft';
const DEFAULT_SITE_DESCRIPTION = 'Guarda, organiza y comparte tus links. Un gestor de enlaces moderno y potente.';
const DEFAULT_IMAGE = '/og-image.png';

/**
 * Generates page title with site name suffix
 *
 * @param title - The page title
 * @param siteName - The site name (defaults to URLoft)
 * @returns Formatted title
 *
 * @example
 * ```ts
 * getpageTitle('Mis Links') // 'Mis Links | URLoft'
 * ```
 */
export function getPageTitle(title: string, siteName: string = DEFAULT_SITE_NAME): string {
	return `${title} | ${siteName}`;
}

/**
 * Generates SEO metadata object for SvelteKit pages
 *
 * @param config - SEO configuration
 * @returns Metadata object for SvelteKit
 *
 * @example
 * ```ts
 * // In +page.ts or +page.server.ts
 * import { getSEOMetadata } from '$lib/utils/seo';
 *
 * export const load = () => {
 *   return getSEOMetadata({
 *     title: 'Home',
 *     description: 'Bienvenido a URLoft',
 *     url: 'https://urloft.site'
 *   });
 * };
 * ```
 */
export function getSEOMetadata(config: SEOConfig): {
	title: string;
	meta: Record<string, string | boolean>;
} {
	const {
		title,
		description,
		image,
		url,
		type = 'website',
		siteName = DEFAULT_SITE_NAME,
		twitterHandle,
		noIndex = false
	} = config;

	const fullTitle = getPageTitle(title, siteName);
	const fullUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

	const meta: Record<string, string | boolean> = {
		// Basic SEO
		description,
		// Open Graph / Facebook
		'og:type': type,
		'og:site_name': siteName,
		'og:title': title,
		'og:description': description,
		// Twitter
		'twitter:card': 'summary_large_image',
		'twitter:title': title,
		'twitter:description': description
	};

	// Optional: Add image
	if (image) {
		meta['og:image'] = image;
		meta['twitter:image'] = image;
	}

	// Optional: Add URL
	if (fullUrl) {
		meta['og:url'] = fullUrl;
		meta['twitter:url'] = fullUrl;
	}

	// Optional: Add Twitter handle
	if (twitterHandle) {
		meta['twitter:site'] = twitterHandle;
		meta['twitter:creator'] = twitterHandle;
	}

	// Optional: No index
	if (noIndex) {
		meta.robots = 'noindex, nofollow';
	}

	return {
		title: fullTitle,
		meta
	};
}

/**
 * Generates metadata for a public user profile
 *
 * @param username - The username
 * @param bio - The user's bio
 * @param avatarUrl - The user's avatar URL
 * @param url - The profile URL
 * @returns SEO metadata
 */
export function getUserProfileMetadata(
	username: string,
	bio?: string | null,
	avatarUrl?: string | null,
	url?: string
): ReturnType<typeof getSEOMetadata> {
	return getSEOMetadata({
		title: `@${username}`,
		description: bio || `Ver los links públicos de @${username} en URLoft`,
		image: avatarUrl || undefined,
		url,
		type: 'profile'
	});
}

/**
 * Generates metadata for a link detail page
 *
 * @param title - Link title
 * @param description - Link description
 * @param imageUrl - Open Graph image URL
 * @param url - The link URL
 * @returns SEO metadata
 */
export function getLinkMetadata(
	title: string,
	description?: string | null,
	imageUrl?: string | null,
	url?: string
): ReturnType<typeof getSEOMetadata> {
	return getSEOMetadata({
		title,
		description: description || `Ver ${title} en URLoft`,
		image: imageUrl || undefined,
		url,
		type: 'article'
	});
}

/**
 * Generates metadata for explore/search page
 *
 * @param query - Search query
 * @param category - Category name
 * @returns SEO metadata
 */
export function getExploreMetadata(
	query?: string | null,
	category?: string | null
): ReturnType<typeof getSEOMetadata> {
	let title = 'Explorar Links';
	let description = DEFAULT_SITE_DESCRIPTION;

	if (query) {
		title = `Buscar: ${query}`;
		description = `Resultados de búsqueda para "${query}" en URLoft`;
	} else if (category) {
		title = category;
		description = `Explorar links en la categoría ${category} en URLoft`;
	}

	return getSEOMetadata({
		title,
		description
	});
}

/**
 * Validates that required SEO fields are present
 *
 * @param config - SEO configuration to validate
 * @returns True if valid, false otherwise
 */
export function validateSEOConfig(config: Partial<SEOConfig>): boolean {
	return !!(config.title && config.description);
}

/**
 * Truncates text to a maximum length for SEO metadata
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 160 for descriptions)
 * @returns Truncated text
 */
export function truncateForSEO(text: string, maxLength: number = 160): string {
	if (text.length <= maxLength) {
		return text;
	}
	return text.slice(0, maxLength - 3).trim() + '...';
}
