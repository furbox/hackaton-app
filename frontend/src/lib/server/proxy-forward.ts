import { PUBLIC_BACKEND_URL } from '$env/static/public';
import type { RequestEvent } from '@sveltejs/kit';
import { normalizeServiceError } from '$lib/services/response';
import type { ProxyMethod, ProxyRoute } from './proxy-map';

const METHODS_WITH_BODY = new Set<ProxyMethod>(['POST', 'PUT', 'PATCH', 'DELETE']);

function buildHeaders(request: Request): Headers {
	const headers = new Headers();
	const contentType = request.headers.get('content-type');
	const accept = request.headers.get('accept');
	const authorization = request.headers.get('authorization');
	const cookie = request.headers.get('cookie');

	if (contentType) {
		headers.set('Content-Type', contentType);
	}
	if (accept) {
		headers.set('Accept', accept);
	}
	if (authorization) {
		headers.set('Authorization', authorization);
	}
	if (cookie) {
		headers.set('Cookie', cookie);
	}

	return headers;
}

function jsonResponse(body: unknown, status: number, setCookie?: string | null): Response {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (setCookie) {
		headers.set('set-cookie', setCookie);
	}

	return new Response(JSON.stringify(body), { status, headers });
}

export async function forwardProxyRequest(
	event: RequestEvent,
	route: ProxyRoute,
	method: ProxyMethod
): Promise<Response> {
	if (!route.methods.includes(method)) {
		return jsonResponse(
			{ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed', status: 405 } },
			405
		);
	}

	const backendPath = route.backendPath(event.params, event.url);
	const backendUrl = `${PUBLIC_BACKEND_URL}${backendPath}${route.includeQuery ? event.url.search : ''}`;

	try {
		const hasBody = METHODS_WITH_BODY.has(method) && event.request.body !== null;
		const upstream = await fetch(backendUrl, {
			method,
			headers: buildHeaders(event.request),
			body: hasBody ? event.request.body : undefined,
			duplex: hasBody ? 'half' : undefined,
			signal: AbortSignal.timeout(route.timeoutMs ?? 5000)
		});

		const setCookie = upstream.headers.get('set-cookie');
		const bodyText = await upstream.text();
		const contentType = upstream.headers.get('content-type') ?? '';

		if (!upstream.ok) {
			let payload: unknown = null;

			if (bodyText && contentType.toLowerCase().includes('application/json')) {
				try {
					payload = JSON.parse(bodyText);
				} catch {
					payload = null;
				}
			}

			return jsonResponse(
				{
					error: normalizeServiceError(
						payload,
						upstream.status,
						route.errorMessage ?? 'Proxy request failed'
					)
				},
				upstream.status,
				setCookie
			);
		}

		const headers = new Headers();
		if (contentType) {
			headers.set('content-type', contentType);
		}
		if (setCookie) {
			headers.set('set-cookie', setCookie);
		}

		return new Response(bodyText || null, {
			status: upstream.status,
			headers
		});
	} catch (error) {
		return jsonResponse(
			{
				error: normalizeServiceError(
					{ error: { code: 'PROXY_UPSTREAM_ERROR', message: (error as Error).message } },
					503,
					route.errorMessage ?? 'Proxy request failed'
				)
			},
			503
		);
	}
}
