/**
 * Utils Index
 *
 * Re-exports all utility functions for convenient importing
 */

export {
	debounce,
	formatRelativeTime,
	formatNumber,
	truncateText,
	stringToColor,
	safeGet,
	clamp,
	generateId,
	isServer,
	isBrowser
} from './index';

export {
	getPageTitle,
	getSEOMetadata,
	getUserProfileMetadata,
	getLinkMetadata,
	getExploreMetadata,
	validateSEOConfig,
	truncateForSEO
} from './seo';
