import { PUBLIC_BACKEND_URL } from '$env/static/public';

/**
 * Standardized API error structure.
 */
export interface ApiError {
	code: string;
	message: string;
	details?: Record<string, any>;
}

/**
 * Standardized API response structure.
 */
export type ApiResponse<T> =
	| {
			ok: true;
			data: T;
	  }
	| {
			ok: false;
			error: ApiError;
			status: number;
	  };

/**
 * Base HTTP client for backend calls.
 * Handles cookie forwarding and standardized error handling.
 */
export class HttpClient {
	private baseUrl: string;

	constructor(baseUrl: string = PUBLIC_BACKEND_URL) {
		this.baseUrl = baseUrl;
	}

	/**
	 * Makes an HTTP request to the backend.
	 *
	 * @param path - The endpoint path (e.g., '/api/links').
	 * @param options - Standard RequestInit with optional `cookies` field.
	 * @returns A standardized ApiResponse.
	 */
	async request<T>(path: string, options: RequestInit & { cookies?: string } = {}): Promise<ApiResponse<T>> {
		const { cookies, ...fetchOptions } = options;
		const url = `${this.baseUrl}${path}`;

		const headers = new Headers(fetchOptions.headers);
		if (cookies) {
			headers.set('Cookie', cookies);
		}
		if (!headers.has('Content-Type') && fetchOptions.body) {
			headers.set('Content-Type', 'application/json');
		}

		try {
			const response = await fetch(url, { ...fetchOptions, headers });

			// Check for non-JSON response (e.g., server crash)
			const contentType = response.headers.get('content-type');
			if (!contentType || !contentType.includes('application/json')) {
				return {
					ok: false,
					error: { code: 'NOT_JSON', message: 'The server did not return JSON' },
					status: response.status
				};
			}

			const result = await response.json();

			if (response.ok) {
				return { ok: true, data: result.data };
			} else {
				return {
					ok: false,
					error: result.error || { code: 'UNKNOWN_ERROR', message: 'Something went wrong' },
					status: response.status
				};
			}
		} catch (error) {
			return {
				ok: false,
				error: { code: 'FETCH_ERROR', message: (error as Error).message },
				status: 500
			};
		}
	}

	get<T>(path: string, options: RequestInit & { cookies?: string } = {}) {
		return this.request<T>(path, { ...options, method: 'GET' });
	}

	post<T>(path: string, body?: any, options: RequestInit & { cookies?: string } = {}) {
		return this.request<T>(path, {
			...options,
			method: 'POST',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	put<T>(path: string, body?: any, options: RequestInit & { cookies?: string } = {}) {
		return this.request<T>(path, {
			...options,
			method: 'PUT',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	delete<T>(path: string, options: RequestInit & { cookies?: string } = {}) {
		return this.request<T>(path, { ...options, method: 'DELETE' });
	}
}

export const http = new HttpClient();
