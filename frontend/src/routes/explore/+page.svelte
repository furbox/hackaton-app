<script lang="ts">
	import SearchBar from '$lib/components/explore/SearchBar.svelte';
	import FilterSidebar from '$lib/components/explore/FilterSidebar.svelte';
	import Pagination from '$lib/components/explore/Pagination.svelte';
	import LinkCard from '$lib/components/links/LinkCard.svelte';

	let { data } = $props<{
		links: any[];
		page: number;
		limit: number;
		total: number;
		sort: string;
		categories: Array<{ id: number; name: string }>;
		query: string;
		categoryId: number | null;
	}>();

	// Add default values for safety
	const links = $derived(data?.links ?? []);
	const page = $derived(data?.page ?? 1);
	const limit = $derived(data?.limit ?? 12);
	const total = $derived(data?.total ?? 0);
	const sort = $derived(data?.sort ?? 'recent');
	const categories = $derived(data?.categories ?? []);
	const query = $derived(data?.query ?? '');
	const categoryId = $derived(data?.categoryId ?? null);

	const totalPages = $derived(Math.ceil(total / limit));
</script>

<svelte:head>
	<title>Explorar Enlaces - URLoft</title>
	<meta
		name="description"
		content="Descubre los mejores enlaces compartidos por la comunidad. Busca por tema, categoría o popularidad."
	/>
	<meta property="og:title" content="Explorar Enlaces - URLoft" />
	<meta
		property="og:description"
		content="Descubre los mejores enlaces compartidos por la comunidad."
	/>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Search Bar -->
	<div class="mb-8">
		<SearchBar placeholder="Buscar enlaces por título, descripción o URL..." />
	</div>

	<!-- Main Content -->
	<div class="flex flex-col lg:flex-row gap-8">
		<!-- Filters Sidebar -->
		<FilterSidebar categories={categories} />

		<!-- Links Grid -->
		<div class="flex-1">
			<!-- Results Header -->
			<div class="flex items-center justify-between mb-6">
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
					{#if query}
						Resultados para "{query}"
					{:else}
						Explorar Enlaces
					{/if}
				</h1>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					{total} enlaces encontrados
				</p>
			</div>

			<!-- Links -->
			{#if links.length === 0}
				<div class="text-center py-12">
					<svg
						class="mx-auto h-12 w-12 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
						No se encontraron enlaces
					</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Intenta ajustar tus filtros o búsqueda.
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
					{#each links as link (link.id)}
						<LinkCard {link} />
					{/each}
				</div>

				<!-- Pagination -->
				<Pagination currentPage={page} totalPages={totalPages} />
			{/if}
		</div>
	</div>
</div>
