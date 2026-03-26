import { session } from '$lib/state';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const ssr = false;
export const csr = true;

export const load: LayoutLoad = () => {
	// Guard básico: si no está autenticado, redirigir al login
	// Nota: Como ssr = false, esto solo corre en el cliente.
	if (!session.isAuthenticated) {
		throw redirect(302, '/auth/login');
	}
};
