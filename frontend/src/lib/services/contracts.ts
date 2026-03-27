export interface ServiceContext {
	cookies?: string;
	fetch?: typeof fetch;
	signal?: AbortSignal;
	headers?: HeadersInit;
}

export interface ServiceError {
	code: string;
	message: string;
	status: number;
	details?: unknown;
}

export type ApiResult<T> =
	| {
			ok: true;
			data: T;
	  }
	| {
			ok: false;
			error: ServiceError;
	  };

export const PROXY_ROUTES = {
	auth: {
		login: '/auth/login',
		register: '/auth/register',
		logout: '/auth/logout',
		session: '/auth/session',
		forgotPassword: '/auth/forgot-password',
		resetPassword: '/auth/reset-password',
		verify: (token: string) => `/auth/verify/${encodeURIComponent(token)}`
	},
	links: {
		list: '/links',
		me: '/links/me',
		byId: (id: number) => `/links/${id}`,
		like: (id: number) => `/links/${id}/like`,
		favorite: (id: number) => `/links/${id}/favorite`,
		preview: '/links/preview'
	},
	categories: {
		list: '/categories',
		byId: (id: number) => `/categories/${id}`
	},
	stats: {
		global: '/stats/global',
		me: '/stats/me'
	},
	users: {
		byUsername: (username: string) => `/users/${encodeURIComponent(username)}`,
		me: '/users/me',
		changePassword: '/users/me/password'
	}
} as const;
