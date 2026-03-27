import type { RequestHandler } from './$types';
import { forwardProxyRequest } from '$lib/server/proxy-forward';
import { PROXY_MAP } from '$lib/server/proxy-map';

export const GET: RequestHandler = (event) => forwardProxyRequest(event, PROXY_MAP.linksById, 'GET');
export const PUT: RequestHandler = (event) => forwardProxyRequest(event, PROXY_MAP.linksById, 'PUT');
export const DELETE: RequestHandler = (event) => forwardProxyRequest(event, PROXY_MAP.linksById, 'DELETE');
