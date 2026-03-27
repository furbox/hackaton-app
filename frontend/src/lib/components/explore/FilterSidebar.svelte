<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let { categories = [] } = $props<{ categories: Array<{ id: number; name: string }> }>();

	const sortOptions = [
		{ value: 'recent', label: 'Más recientes' },
		{ value: 'likes', label: 'Más likeados' },
		{ value: 'views', label: 'Más vistos' },
		{ value: 'favorites', label: 'Más favoritos' }
	];

	const currentSort = $derived(page.url.searchParams.get('sort') || 'recent');
	const currentCategory = $derived(page.url.searchParams.get('categoryId') || '');

	const updateFilter = (key: string, value: string) => {
		const url = new URL(window.location.href);
		if (value) {
			url.searchParams.set(key, value);
		} else {
			url.searchParams.delete(key);
		}
		// Reset to page 1 when filtering
		url.searchParams.set('page', '1');
		goto(url.toString(), { keepFocus: true });
	};

	const clearFilters = () => {
		const url = new URL(window.location.href);
		url.searchParams.delete('sort');
		url.searchParams.delete('categoryId');
		url.searchParams.set('page', '1');
		goto(url.toString(), { keepFocus: true });
	};

	const hasActiveFilters = $derived(currentSort !== 'recent' || currentCategory !== '');

	const handleSortChange = (e: Event) => {
		const target = e.target as HTMLSelectElement;
		updateFilter('sort', target.value);
	};

	const handleCategoryChange = (e: Event) => {
		const target = e.target as HTMLSelectElement;
		updateFilter('categoryId', target.value);
	};

	const handlePublicChange = (e: Event) => {
		const target = e.target as HTMLInputElement;
		updateFilter('isPublic', target.checked ? 'true' : '');
	};</script>

<aside class="w-full lg:w-64 flex-shrink-0">
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 sticky top-4">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Filtros</h3>
			{#if hasActiveFilters}
				<button
					onclick={clearFilters}
					class="text-sm text-primary hover:text-primary/80 dark:text-indigo-400 dark:hover:text-indigo-300"
				>
					Limpiar
				</button>
			{/if}
		</div>

		<div class="space-y-6">
			<!-- Sort -->
			<div>
				<label for="sort" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					Ordenar por
				</label>
				<select
					id="sort"
					value={currentSort}
					onchange={handleSortChange}
					class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
				>
					{#each sortOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<!-- Category -->
			<div>
				<label
					for="category"
					class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
				>
					Categoría
				</label>
				<select
					id="category"
					value={currentCategory}
					onchange={handleCategoryChange}
					class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
				>
					<option value="">Todas</option>
					{#each categories as category}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</div>

			<!-- Public only toggle -->
			<div class="flex items-center">
				<input
					id="publicOnly"
					type="checkbox"
					checked={page.url.searchParams.get('isPublic') === 'true'}
					onchange={handlePublicChange}
					class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
				/>
				<label
					for="publicOnly"
					class="ml-2 block text-sm text-gray-900 dark:text-gray-300"
				>
					Solo públicos
				</label>
			</div>
		</div>
	</div>
</aside>
