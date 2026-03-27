import type { RequestHandler } from './$types';
import { forwardProxyRequest } from '$lib/server/proxy-forward';
import { PROXY_MAP } from '$lib/server/proxy-map';

export const PUT: RequestHandler = (event) => forwardProxyRequest(event, PROXY_MAP.usersMe, 'PUT');
