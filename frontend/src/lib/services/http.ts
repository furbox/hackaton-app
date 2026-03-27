import type { ApiResult, ServiceContext } from './contracts';
import { errorResult, successResult } from './response';

type HttpRequestOptions = RequestInit & ServiceContext;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object');
}

/**
 * Base HTTP client for proxy calls.
 * Handles cookie forwarding and standardized error handling.
 */
export class HttpClient {
	private baseUrl: string;

	constructor(baseUrl: string = '/api/proxy') {
		this.baseUrl = baseUrl;
	}

	/**
	 * Makes an HTTP request to the backend.
	 *
	 * @param path - The endpoint path (e.g., '/links').
	 * @param options - Standard RequestInit with optional `cookies` field.
	 * @returns A standardized ApiResult.
	 */
	async request<T>(path: string, options: HttpRequestOptions = {}): Promise<ApiResult<T>> {
		const { cookies, fetch: requestFetch, ...fetchOptions } = options;
		const url = `${this.baseUrl}${path}`;
		const executeFetch = requestFetch ?? fetch;

		const headers = new Headers(fetchOptions.headers);
		if (cookies) {
			headers.set('Cookie', cookies);
		}
		if (!headers.has('Content-Type') && fetchOptions.body) {
			headers.set('Content-Type', 'application/json');
		}

		try {
			const response = await executeFetch(url, { ...fetchOptions, headers });
			if (response.status === 204) {
				return successResult(null as T);
			}

			const bodyText = await response.text();
			let payload: unknown = null;

			if (bodyText) {
				try {
					payload = JSON.parse(bodyText);
				} catch {
					if (response.ok) {
						return errorResult(response.status, null, 'Invalid JSON response from proxy');
					}
				}
			}

			if (response.ok) {
				if (isRecord(payload) && 'data' in payload) {
					return successResult(payload.data as T);
				}

				return successResult(payload as T);
			}

			return errorResult(response.status, payload, 'Request failed');
		} catch (error) {
			return errorResult(
				503,
				{ error: { code: 'FETCH_ERROR', message: (error as Error).message } },
				'Network request failed'
			);
		}
	}

	get<T>(path: string, options: HttpRequestOptions = {}) {
		return this.request<T>(path, { ...options, method: 'GET' });
	}

	post<T>(path: string, body?: unknown, options: HttpRequestOptions = {}) {
		return this.request<T>(path, {
			...options,
			method: 'POST',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	put<T>(path: string, body?: unknown, options: HttpRequestOptions = {}) {
		return this.request<T>(path, {
			...options,
			method: 'PUT',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	delete<T>(path: string, options: HttpRequestOptions = {}) {
		return this.request<T>(path, { ...options, method: 'DELETE' });
	}
}

export const http = new HttpClient();
