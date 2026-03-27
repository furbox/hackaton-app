import type { PageData, PageServerData } from './$types';

export const load = async ({ data }: { data: PageServerData }) => {
	return {
		meta: {
			title: 'URLoft - Tus enlaces en la nube',
			description:
				'Descubre, guarda y comparte los mejores enlaces de la comunidad de desarrolladores. Tu gestor de enlaces personal con búsqueda avanzada y categorización.',
			image: '/og-image.png'
		}
	};
};
