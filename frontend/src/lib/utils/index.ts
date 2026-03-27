/**
 * Utility functions for the frontend
 */

/**
 * Debounces a function call
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 *
 * @example
 * ```svelte
 * <script>
 *   import { debounce } from '$lib/utils';
 *
 *   const handleSearch = debounce((query: string) => {
 *     console.log('Searching for:', query);
 *   }, 300);
 * </script>
 *
 * <input oninput={(e) => handleSearch(e.target.value)} />
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return function (this: any, ...args: Parameters<T>) {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			fn.apply(this, args);
		}, delay);
	};
}

/**
 * Formats a date as a relative time string
 *
 * @param dateString - ISO date string
 * @returns Relative time string
 *
 * @example
 * ```ts
 * formatRelativeTime('2024-03-26T10:00:00Z') // 'Hace 2 horas'
 * ```
 */
export function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);
	const diffWeeks = Math.floor(diffDays / 7);
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffSeconds < 60) return 'ahora mismo';
	if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
	if (diffHours < 24) return `Hace ${diffHours} h`;
	if (diffDays === 1) return 'Ayer';
	if (diffDays < 7) return `Hace ${diffDays} días`;
	if (diffWeeks < 4) return `Hace ${diffWeeks} sem`;
	if (diffMonths < 12) return `Hace ${diffMonths} meses`;
	return `Hace ${diffYears} años`;
}

/**
 * Formats a number as a compact string (e.g., 1.2K, 1.5M)
 *
 * @param num - Number to format
 * @returns Formatted string
 *
 * @example
 * ```ts
 * formatNumber(1200) // '1.2K'
 * formatNumber(1500000) // '1.5M'
 * ```
 */
export function formatNumber(num: number): string {
	if (num < 1000) return num.toString();
	if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
	if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
	return `${(num / 1000000000).toFixed(1)}B`;
}

/**
 * Truncates text to a maximum length and adds ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3).trim() + '...';
}

/**
 * Generates a color hash from a string
 *
 * @param str - String to hash
 * @returns Hex color code
 *
 * @example
 * ```ts
 * stringToColor('user123') // '#7b1fa2'
 * ```
 */
export function stringToColor(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}

	const color = Math.abs(hash).toString(16).slice(0, 6);
	return `#${color.padStart(6, '0')}`;
}

/**
 * Safely gets a nested property from an object
 *
 * @param obj - Object to query
 * @param path - Dot-separated path (e.g., 'user.profile.name')
 * @param defaultValue - Default value if path doesn't exist
 * @returns Value at path or default value
 *
 * @example
 * ```ts
 * const user = { profile: { name: 'John' } };
 * safeGet(user, 'profile.name', 'Anonymous') // 'John'
 * safeGet(user, 'profile.age', 0) // 0
 * ```
 */
export function safeGet<T>(obj: any, path: string, defaultValue?: T): T | undefined {
	const keys = path.split('.');
	let result = obj;

	for (const key of keys) {
		if (result === null || result === undefined) {
			return defaultValue;
		}
		result = result[key];
	}

	return result !== undefined ? result : defaultValue;
}

/**
 * Clamps a number between a minimum and maximum value
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Generates a random ID
 *
 * @param length - Length of ID (default: 8)
 * @returns Random ID string
 */
export function generateId(length: number = 8): string {
	return Math.random().toString(36).slice(2, 2 + length);
}

/**
 * Checks if code is running on the server
 */
export const isServer = typeof window === 'undefined';

/**
 * Checks if code is running on the client
 */
export const isBrowser = typeof window !== 'undefined';
