import type { PageServerLoad } from './$types';
import { authService } from '$lib/services';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const token = params.token?.trim() ?? '';

	if (!token || token.includes('/')) {
		return {
			success: false,
			message: 'El enlace de verificacion es invalido.',
			invalidToken: true
		};
	}

	try {
		const response = await authService.verifyEmail(token, {
			fetch,
			signal: AbortSignal.timeout(5000)
		});

		if (!response.ok) {
			return {
				success: false,
				message: response.error.message || 'No se pudo verificar tu email. Proba solicitando un nuevo enlace.',
				invalidToken: response.error.status === 400 || response.error.status === 404
			};
		}

		return {
			success: true,
			message: response.data.message || 'Email verificado correctamente'
		};
	} catch (error) {
		console.error('Verification error:', error);
		return {
			success: false,
			message: 'Error al conectar con el servidor',
			invalidToken: false
		};
	}
};
