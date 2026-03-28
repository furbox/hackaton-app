import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
	const linkId = parseInt(params.id);

	if (isNaN(linkId)) {
		throw new Error('Invalid link ID');
	}

	const response = await fetch(`/api/links/${linkId}/details`, {
		headers: {
			cookie: cookies.get('cookie') ?? ''
		},
		signal: AbortSignal.timeout(5000)
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || 'Failed to load link details');
	}

	const data = await response.json();

	return {
		details: data.data
	};
};
