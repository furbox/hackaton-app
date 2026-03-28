import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const ssr = false;
export const csr = true;

export const load: LayoutLoad = async ({ parent, url }) => {
	const { session } = await parent();

	if (!session?.user) {
		const next = `${url.pathname}${url.search}`;
		throw redirect(302, `/auth/login?next=${encodeURIComponent(next)}`);
	}
};
