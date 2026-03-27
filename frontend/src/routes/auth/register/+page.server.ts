import type { Actions, PageServerLoad } from './$types';
import { authService } from '$lib/services';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	register: async ({ request, fetch }) => {
		const formData = await request.formData();
		const username = formData.get('username') as string;
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!username || !email || !password || !confirmPassword) {
			return {
				error: 'Todos los campos son requeridos',
				data: { username, email }
			};
		}

		if (password !== confirmPassword) {
			return {
				error: 'Las contraseñas no coinciden',
				data: { username, email }
			};
		}

		if (password.length < 8) {
			return {
				error: 'La contraseña debe tener al menos 8 caracteres',
				data: { username, email }
			};
		}

		if (!/^[a-zA-Z0-9_]+$/.test(username)) {
			return {
				error: 'El usuario solo puede contener letras, números y guiones bajos',
				data: { username, email }
			};
		}

		try {
			const response = await authService.register(
				{ name: username, username, email, password },
				{
					fetch,
					cookies: request.headers.get('cookie') ?? undefined,
					signal: AbortSignal.timeout(5000)
				}
			);

			if (!response.ok) {
				return {
					error: response.error.message || 'Error al registrar',
					data: { username, email }
				};
			}

			return {
				success: true,
				message: '¡Cuenta creada! Por favor verifica tu email antes de iniciar sesión.'
			};
		} catch (error) {
			console.error('Registration error:', error);
			return {
				error: 'Error al conectar con el servidor',
				data: { username, email }
			};
		}
	}
};
