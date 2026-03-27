<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let { placeholder = 'Buscar enlaces...' } = $props();

	// Initialize search value from URL (no $effect needed)
	let searchValue = $state(page.url.searchParams.get('q') || '');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const handleInput = (e: Event) => {
		const input = e.target as HTMLInputElement;
		searchValue = input.value;

		// Clear previous timer
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Debounce for 300ms
		debounceTimer = setTimeout(() => {
			updateSearchParam(searchValue);
		}, 300);
	};

	const updateSearchParam = (value: string) => {
		const url = new URL(window.location.href);
		if (value) {
			url.searchParams.set('q', value);
		} else {
			url.searchParams.delete('q');
		}
		// Reset to page 1 when searching
		url.searchParams.set('page', '1');
		goto(url.toString(), { keepFocus: true });
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		updateSearchParam(searchValue);
	};
</script>

<form onsubmit={handleSubmit} class="relative">
	<div class="relative">
		<input
			type="text"
			bind:value={searchValue}
			oninput={handleInput}
			placeholder={placeholder}
			class="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
		/>
		<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
			<svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
		</div>
		{#if searchValue}
			<button
				type="button"
				aria-label="Clear search"
				onclick={() => {
					searchValue = '';
					updateSearchParam('');
				}}
				class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		{/if}
	</div>
</form>
