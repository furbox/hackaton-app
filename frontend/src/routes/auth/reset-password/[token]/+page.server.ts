import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { authService } from '$lib/services';

export const load: PageServerLoad = async ({ params }) => {
	return {
		token: params.token
	};
};

export const actions: Actions = {
	resetPassword: async ({ request, fetch }) => {
		const formData = await request.formData();
		const token = formData.get('token') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!token || !password || !confirmPassword) {
			return {
				error: 'Todos los campos son requeridos'
			};
		}

		if (password !== confirmPassword) {
			return {
				error: 'Las contraseñas no coinciden'
			};
		}

		if (password.length < 8) {
			return {
				error: 'La contraseña debe tener al menos 8 caracteres'
			};
		}

		try {
			const response = await authService.resetPassword(
				{ token, password },
				{
					fetch,
					cookies: request.headers.get('cookie') ?? undefined,
					signal: AbortSignal.timeout(5000)
				}
			);

			if (!response.ok) {
				return {
					error: response.error.message || 'Error al restablecer contraseña'
				};
			}

			// Password reset successful, redirect to login
			throw redirect(303, '/auth/login?reset=success');
		} catch (error) {
			// If it's a redirect, throw it
			if (error && typeof error === 'object' && 'status' in error) {
				throw error;
			}

			console.error('Reset password error:', error);
			return {
				error: 'Error al conectar con el servidor'
			};
		}
	}
};
