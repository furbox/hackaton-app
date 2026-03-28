<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let { currentPage = 1, totalPages = 1, baseUrl = '/explore' } = $props<{
		currentPage: number;
		totalPages: number;
		baseUrl?: string;
	}>();

	const getPageUrl = (page: number) => {
		const url = new URL(window.location.href);
		url.searchParams.set('page', page.toString());
		return url.pathname + url.search;
	};

	const goToPage = (page: number) => {
		const url = new URL(window.location.href);
		url.searchParams.set('page', page.toString());
		goto(url.toString());
	};

	const visiblePages = $derived.by(() => {
		const pages: (number | string)[] = [];
		const delta = 2;

		if (totalPages <= 7) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			pages.push(1);

			if (currentPage > delta + 3) {
				pages.push('...');
			}

			const start = Math.max(2, currentPage - delta);
			const end = Math.min(totalPages - 1, currentPage + delta);

			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			if (currentPage < totalPages - delta - 2) {
				pages.push('...');
			}

			pages.push(totalPages);
		}

		return pages;
	});
</script>

{#if totalPages > 1}
	<nav class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
		<div class="flex-1 flex justify-between sm:hidden">
			<button
				disabled={currentPage === 1}
				onclick={() => goToPage(currentPage - 1)}
				class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Anterior
			</button>
			<button
				disabled={currentPage === totalPages}
				onclick={() => goToPage(currentPage + 1)}
				class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Siguiente
			</button>
		</div>

		<div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
			<div>
				<p class="text-sm text-gray-700 dark:text-gray-300">
					Página
					<span class="font-medium">{currentPage}</span>
					de
					<span class="font-medium">{totalPages}</span>
				</p>
			</div>
			<div>
				<nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
					<button
						disabled={currentPage === 1}
						onclick={() => goToPage(currentPage - 1)}
						class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<span class="sr-only">Anterior</span>
						<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>

					{#each visiblePages as pageNum (pageNum)}
						{#if pageNum === '...'}
							<span class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
								...
							</span>
						{:else}
							<button
								onclick={() => goToPage(pageNum as number)}
								class="relative inline-flex items-center px-4 py-2 border text-sm font-medium {pageNum === currentPage
									? 'z-10 bg-primary border-primary text-white'
									: 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}"
							>
								{pageNum}
							</button>
						{/if}
					{/each}

					<button
						disabled={currentPage === totalPages}
						onclick={() => goToPage(currentPage + 1)}
						class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<span class="sr-only">Siguiente</span>
						<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</nav>
			</div>
		</div>
	</nav>
{/if}
