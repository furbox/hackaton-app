import type { Actions, PageServerLoad } from './$types';
import { authService } from '$lib/services';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	requestReset: async ({ request, fetch }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;

		if (!email) {
			return {
				error: 'Email es requerido',
				email
			};
		}

		try {
			const response = await authService.requestPasswordReset(
				{ email },
				{
					fetch,
					cookies: request.headers.get('cookie') ?? undefined,
					signal: AbortSignal.timeout(5000)
				}
			);

			if (!response.ok) {
				return {
					error: response.error.message || 'Error al solicitar recuperación',
					email
				};
			}

			return {
				success: true,
				message: 'Se ha enviado un email con las instrucciones para restablecer tu contraseña',
				email
			};
		} catch (error) {
			console.error('Forgot password error:', error);
			return {
				error: 'Error al conectar con el servidor',
				email
			};
		}
	}
};
