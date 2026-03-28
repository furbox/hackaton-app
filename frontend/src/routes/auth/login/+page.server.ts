import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { authService } from '$lib/services';

const DEFAULT_POST_LOGIN_PATH = '/dashboard';

function resolvePostLoginPath(url: URL): string {
	const next = url.searchParams.get('next') ?? url.searchParams.get('redirectTo');

	if (!next || !next.startsWith('/')) {
		return DEFAULT_POST_LOGIN_PATH;
	}

	return next;
}

function mapLoginErrorMessage(code: string | undefined, message: string): string {
	if (code === 'EMAIL_NOT_VERIFIED') {
		return 'Tu email todavia no esta verificado. Revisa tu bandeja y confirmalo antes de iniciar sesion.';
	}

	return message;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.session?.user) {
		throw redirect(303, resolvePostLoginPath(url));
	}

	return {};
};

export const actions: Actions = {
	login: async ({ request, fetch, url }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const postLoginPath = resolvePostLoginPath(url);

		if (!email || !password) {
			return fail(400, {
				error: 'Email y contraseña son requeridos',
				email,
				errorCode: 'VALIDATION_ERROR'
			});
		}

		let response;
		try {
			response = await authService.login(
				{ email, password },
				{
					fetch,
					cookies: request.headers.get('cookie') ?? undefined,
					signal: AbortSignal.timeout(5000)
				}
			);
		} catch (error) {
			console.error('Login error:', error);
			return fail(503, {
				error: 'Error al conectar con el servidor',
				email,
				errorCode: 'NETWORK_ERROR'
			});
		}

		if (!response.ok) {
			const errorMessage = mapLoginErrorMessage(
				response.error.code,
				response.error.message || 'Error al iniciar sesión'
			);

			return fail(response.error.status || 400, {
				error: errorMessage,
				email,
				errorCode: response.error.code
			});
		}

		throw redirect(303, postLoginPath);
	}
};
