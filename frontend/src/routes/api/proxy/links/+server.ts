import type { RequestHandler } from './$types';
import { forwardProxyRequest } from '$lib/server/proxy-forward';
import { PROXY_MAP } from '$lib/server/proxy-map';

export const GET: RequestHandler = (event) => forwardProxyRequest(event, PROXY_MAP.linksList, 'GET');
export const POST: RequestHandler = (event) => forwardProxyRequest(event, PROXY_MAP.linksList, 'POST');
