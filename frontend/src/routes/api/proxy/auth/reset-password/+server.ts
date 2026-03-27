import type { RequestHandler } from './$types';
import { forwardProxyRequest } from '$lib/server/proxy-forward';
import { PROXY_MAP } from '$lib/server/proxy-map';

export const POST: RequestHandler = (event) => forwardProxyRequest(event, PROXY_MAP.authResetPassword, 'POST');
