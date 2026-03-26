<script lang="ts">
	import { session } from '$lib/state';
	import { page } from '$app/state';

	const getBreadcrumbs = (path: string) => {
		const parts = path.split('/').filter(Boolean);
		return parts.map((part, index) => {
			const href = '/' + parts.slice(0, index + 1).join('/');
			// Traducir nombres comunes para mejor UX
			const translations: Record<string, string> = {
				dashboard: 'Panel',
				links: 'Mis Links',
				categories: 'Categorías',
				keys: 'API Keys',
				favorites: 'Favoritos',
				profile: 'Perfil',
				import: 'Importar'
			};
			const name = translations[part.toLowerCase()] || (part.charAt(0).toUpperCase() + part.slice(1));
			return { name, href };
		});
	};

	const breadcrumbs = $derived(getBreadcrumbs(page.url.pathname));
</script>

<header class="bg-white border-b border-gray-200 h-16 dark:bg-gray-900 dark:border-gray-800 sticky top-0 z-20 flex items-center justify-between px-4 sm:px-8">
	<nav class="flex text-sm text-gray-500 dark:text-gray-400" aria-label="Breadcrumb">
		<ol class="flex items-center space-x-1 sm:space-x-2">
			{#each breadcrumbs as crumb, i}
				<li class="flex items-center">
					{#if i > 0}
						<svg class="h-4 w-4 mx-1 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
						</svg>
					{/if}
					<a href={crumb.href} class="hover:text-gray-900 dark:hover:text-white transition-colors {i === breadcrumbs.length - 1 ? 'font-semibold text-gray-900 dark:text-white' : ''}">
						{crumb.name}
					</a>
				</li>
			{/each}
		</ol>
	</nav>

	<div class="flex items-center space-x-4">
		<div class="hidden sm:flex flex-col items-end">
			<span class="text-sm font-medium text-gray-900 dark:text-white">{session.displayName}</span>
			<span class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold">
				{session.user?.rank ?? 'newbie'}
			</span>
		</div>
		<div class="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-primary/20">
			{session.displayName.charAt(0).toUpperCase()}
		</div>
	</div>
</header>
