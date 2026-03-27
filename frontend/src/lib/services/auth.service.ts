import type { ApiResult, ServiceContext } from './contracts';
import { PROXY_ROUTES } from './contracts';
import { http } from './http';

type RequestContext = ServiceContext | string | undefined;

function resolveContext(ctx: RequestContext): ServiceContext | undefined {
	if (!ctx) {
		return undefined;
	}

	if (typeof ctx === 'string') {
		return { cookies: ctx };
	}

	return ctx;
}

export interface RegisterInput {
	email: string;
	password: string;
	name: string;
	username?: string;
}

export interface LoginInput {
	email: string;
	password: string;
}

export interface ForgotPasswordInput {
	email: string;
}

export interface ResetPasswordInput {
	token: string;
	password: string;
}

export interface AuthResponse {
	user: {
		id: number;
		username: string;
		email: string;
		name: string | null;
		avatarUrl: string | null;
		rank: string;
	};
}

export interface SessionResponse {
	user: {
		id: number;
		username: string;
		email: string;
		avatarUrl: string | null;
		rank: string;
	} | null;
	token: string | null;
}

export interface VerifyResponse {
	success: boolean;
	message: string;
}

export class AuthService {
	async register(input: RegisterInput, ctx?: RequestContext): Promise<ApiResult<AuthResponse>> {
		return http.post<AuthResponse>(PROXY_ROUTES.auth.register, input, resolveContext(ctx));
	}

	async login(input: LoginInput, ctx?: RequestContext): Promise<ApiResult<AuthResponse>> {
		return http.post<AuthResponse>(PROXY_ROUTES.auth.login, input, resolveContext(ctx));
	}

	async logout(ctx?: RequestContext): Promise<ApiResult<{ success: true }>> {
		return http.post<{ success: true }>(PROXY_ROUTES.auth.logout, {}, resolveContext(ctx));
	}

	async getSession(ctx?: RequestContext): Promise<ApiResult<SessionResponse | null>> {
		return http.get<SessionResponse | null>(PROXY_ROUTES.auth.session, resolveContext(ctx));
	}

	async verifyEmail(token: string, ctx?: RequestContext): Promise<ApiResult<VerifyResponse>> {
		return http.get<VerifyResponse>(PROXY_ROUTES.auth.verify(token), resolveContext(ctx));
	}

	async requestPasswordReset(input: ForgotPasswordInput, ctx?: RequestContext): Promise<ApiResult<{ success: true }>> {
		return http.post<{ success: true }>(PROXY_ROUTES.auth.forgotPassword, input, resolveContext(ctx));
	}

	async resetPassword(input: ResetPasswordInput, ctx?: RequestContext): Promise<ApiResult<{ success: true }>> {
		return http.post<{ success: true }>(
			PROXY_ROUTES.auth.resetPassword,
			{
				token: input.token,
				newPassword: input.password
			},
			resolveContext(ctx)
		);
	}
}

export const authService = new AuthService();
