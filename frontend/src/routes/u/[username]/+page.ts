import type { PageData, PageServerData } from './$types';

export const load = async ({ data }: { data: PageServerData }) => {
	const user = data.user;

	return {
		meta: {
			title: `${user.username} - URLoft`,
			description: user.bio || `Perfil de ${user.name || user.username} en URLoft`,
			image: user.avatarUrl || '/default-avatar.png'
		}
	};
};
