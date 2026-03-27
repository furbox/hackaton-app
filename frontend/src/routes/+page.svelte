<script lang="ts">
	import HeroSection from '$lib/components/home/HeroSection.svelte';
	import FeaturedLinks from '$lib/components/home/FeaturedLinks.svelte';
	import TopUsers from '$lib/components/home/TopUsers.svelte';

	let { data } = $props<{
		stats: { totalUsers: number; totalLinks: number; totalCategories: number };
		featuredLinks: any[];
		topUsers: any[];
	}>();

	// Add default values for safety
	const stats = $derived(data?.stats ?? { totalUsers: 0, totalLinks: 0, totalCategories: 0 });
	const featuredLinks = $derived(data?.featuredLinks ?? []);
	const topUsers = $derived(data?.topUsers ?? []);
</script>

<svelte:head>
	<title>URLoft - Tus enlaces en la nube</title>
	<meta
		name="description"
		content="Descubre, guarda y comparte los mejores enlaces de la comunidad de desarrolladores. Tu gestor de enlaces personal con búsqueda avanzada y categorización."
	/>
	<meta property="og:title" content="URLoft - Tus enlaces en la nube" />
	<meta
		property="og:description"
		content="Descubre, guarda y comparte los mejores enlaces de la comunidad de desarrolladores."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/og-image.png" />
</svelte:head>

<HeroSection />

<FeaturedLinks links={featuredLinks} />

<!-- Global Stats Section -->
<section class="py-12 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
			<div>
				<div class="text-4xl font-bold text-primary dark:text-indigo-400">
					{stats.totalLinks.toLocaleString()}
				</div>
				<div class="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
					Enlaces guardados
				</div>
			</div>
			<div>
				<div class="text-4xl font-bold text-primary dark:text-indigo-400">
					{stats.totalUsers.toLocaleString()}
				</div>
				<div class="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
					Usuarios activos
				</div>
			</div>
			<div>
				<div class="text-4xl font-bold text-primary dark:text-indigo-400">
					{stats.totalCategories.toLocaleString()}
				</div>
				<div class="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
					Categorías
				</div>
			</div>
		</div>
	</div>
</section>

<TopUsers users={topUsers} />
