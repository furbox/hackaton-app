<script lang="ts">
	import { page } from '$app/state';

	const navItems = [
		{ name: 'Dashboard', href: '/dashboard', icon: '📊', exact: true },
		{ name: 'Mis Links', href: '/dashboard/links', icon: '🔗' },
		{ name: 'Categorías', href: '/dashboard/categories', icon: '📂' },
		{ name: 'API Keys', href: '/dashboard/keys', icon: '🔑' },
		{ name: 'Favoritos', href: '/dashboard/favorites', icon: '⭐' },
		{ name: 'Perfil', href: '/dashboard/profile', icon: '👤' },
		{ name: 'Importar', href: '/dashboard/import', icon: '📥' }
	];

	const isActive = (item: { href: string; exact?: boolean }) => {
		if (item.exact) {
			return page.url.pathname === item.href;
		}
		return page.url.pathname.startsWith(item.href);
	};
</script>

<aside class="w-64 bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-gray-800 hidden md:flex flex-col h-full sticky top-0 overflow-y-auto">
	<div class="p-6">
		<a href="/" class="text-2xl font-bold text-primary">URLoft</a>
	</div>
	<nav class="flex-grow px-4 space-y-1">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors {isActive(item)
					? 'bg-primary/10 text-primary font-semibold'
					: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'}"
			>
				<span class="mr-3 text-lg">{item.icon}</span>
				{item.name}
			</a>
		{/each}
	</nav>
	<div class="p-4 border-t border-gray-200 dark:border-gray-800">
		<div class="flex items-center space-x-2 text-xs text-gray-400 dark:text-gray-500">
			<span>v1.0.0 Alpha</span>
		</div>
	</div>
</aside>
