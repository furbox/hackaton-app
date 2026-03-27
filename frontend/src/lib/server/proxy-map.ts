export type ProxyMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ProxyRoute {
	methods: readonly ProxyMethod[];
	backendPath: (params: Record<string, string>, url: URL) => string;
	includeQuery?: boolean;
	timeoutMs?: number;
	errorMessage?: string;
}

const staticPath = (path: string) => (_params: Record<string, string>, _url: URL) => path;

export const PROXY_MAP = {
	authLogin: {
		methods: ['POST'],
		backendPath: staticPath('/api/auth/login'),
		errorMessage: 'Error al iniciar sesión'
	},
	authRegister: {
		methods: ['POST'],
		backendPath: staticPath('/api/auth/register'),
		errorMessage: 'Error al registrar usuario'
	},
	authLogout: {
		methods: ['POST'],
		backendPath: staticPath('/api/auth/logout'),
		errorMessage: 'Error al cerrar sesión'
	},
	authSession: {
		methods: ['GET'],
		backendPath: staticPath('/api/auth/session'),
		timeoutMs: 3000,
		errorMessage: 'No se pudo validar la sesión'
	},
	authForgotPassword: {
		methods: ['POST'],
		backendPath: staticPath('/api/auth/forgot-password'),
		errorMessage: 'Error al solicitar recuperación'
	},
	authResetPassword: {
		methods: ['POST'],
		backendPath: staticPath('/api/auth/reset-password'),
		errorMessage: 'Error al restablecer contraseña'
	},
	authVerify: {
		methods: ['GET'],
		backendPath: (params) => `/api/auth/verify/${encodeURIComponent(params.token ?? '')}`,
		timeoutMs: 5000,
		errorMessage: 'No se pudo verificar el email'
	},
	linksList: {
		methods: ['GET', 'POST'],
		backendPath: staticPath('/api/links'),
		includeQuery: true,
		errorMessage: 'Error al procesar enlaces'
	},
	linksById: {
		methods: ['GET', 'PUT', 'DELETE'],
		backendPath: (params) => `/api/links/${params.id}`,
		errorMessage: 'Error al procesar enlace'
	},
	linksMe: {
		methods: ['GET'],
		backendPath: staticPath('/api/links/me'),
		includeQuery: true,
		errorMessage: 'Error al cargar enlaces del usuario'
	},
	linksLike: {
		methods: ['POST'],
		backendPath: (params) => `/api/links/${params.id}/like`,
		errorMessage: 'Error al actualizar like'
	},
	linksFavorite: {
		methods: ['POST'],
		backendPath: (params) => `/api/links/${params.id}/favorite`,
		errorMessage: 'Error al actualizar favorito'
	},
	linksPreview: {
		methods: ['POST'],
		backendPath: staticPath('/api/links/preview'),
		errorMessage: 'Error al obtener preview del enlace'
	},
	categoriesList: {
		methods: ['GET', 'POST'],
		backendPath: staticPath('/api/categories'),
		includeQuery: true,
		errorMessage: 'Error al procesar categorías'
	},
	categoriesById: {
		methods: ['PUT', 'DELETE'],
		backendPath: (params) => `/api/categories/${params.id}`,
		includeQuery: true,
		errorMessage: 'Error al procesar categoría'
	},
	statsGlobal: {
		methods: ['GET'],
		backendPath: staticPath('/api/stats/global'),
		errorMessage: 'Error al cargar estadísticas globales'
	},
	statsMe: {
		methods: ['GET'],
		backendPath: staticPath('/api/stats/me'),
		errorMessage: 'Error al cargar estadísticas del usuario'
	},
	usersByUsername: {
		methods: ['GET'],
		backendPath: (params) => `/api/users/${encodeURIComponent(params.username ?? '')}`,
		timeoutMs: 5000,
		errorMessage: 'Error al cargar perfil de usuario'
	},
	usersMe: {
		methods: ['PUT'],
		backendPath: staticPath('/api/users/me'),
		errorMessage: 'Error al actualizar perfil'
	},
	usersMePassword: {
		methods: ['PUT'],
		backendPath: staticPath('/api/users/me/password'),
		errorMessage: 'Error al actualizar contraseña'
	}
} satisfies Record<string, ProxyRoute>;
