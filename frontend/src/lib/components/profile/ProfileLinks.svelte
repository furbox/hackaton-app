<script lang="ts">
	import LinkCard from '../links/LinkCard.svelte';
	import type { LinkListItemDTO } from '$lib/services/links.service';

	type TabType = 'all' | 'public' | 'featured';

	let { links = [] } = $props<{ links: LinkListItemDTO[] }>();

	let activeTab = $state<TabType>('all');

	const tabs = $derived.by(() => [
		{ id: 'all' as TabType, label: 'Todos', count: links.length },
		{
			id: 'public' as TabType,
			label: 'Públicos',
			count: links.filter((l: LinkListItemDTO) => l.isPublic).length
		},
		{
			id: 'featured' as TabType,
			label: 'Destacados',
			count: links.filter((l: LinkListItemDTO) => l.likesCount > 5).length
		}
	]);

	const filteredLinks = $derived.by(() => {
		switch (activeTab) {
			case 'public':
				return links.filter((l: LinkListItemDTO) => l.isPublic);
			case 'featured':
				return links.filter((l: LinkListItemDTO) => l.likesCount > 5);
			default:
				return links;
		}
	});
</script>

<div>
	<!-- Tabs -->
	<div class="border-b border-gray-200 dark:border-gray-700 mb-6">
		<nav class="flex -mb-px space-x-8" aria-label="Tabs">
			{#each tabs as tab (tab.id)}
				<button
					onclick={() => (activeTab = tab.id)}
					class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === tab.id
						? 'border-primary text-primary dark:border-indigo-400 dark:text-indigo-400'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}"
				>
					{tab.label}
					<span
						class="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
					>
						{tab.count}
					</span>
				</button>
			{/each}
		</nav>
	</div>

	<!-- Links Grid -->
	{#if filteredLinks.length === 0}
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
					d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
				/>
			</svg>
			<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay enlaces</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Este usuario no tiene enlaces en esta categoría.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each filteredLinks as link (link.id)}
				<LinkCard {link} />
			{/each}
		</div>
	{/if}
</div>
