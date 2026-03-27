<script lang="ts">
	import LinkCard from '../links/LinkCard.svelte';
	import type { LinkListItemDTO } from '$lib/services/links.service';

	let { links = [] } = $props<{ links: LinkListItemDTO[] }>();
</script>

<section class="py-12 bg-gray-50 dark:bg-gray-900">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between mb-8">
			<h2 class="text-3xl font-bold text-gray-900 dark:text-white">
				Links Destacados
			</h2>
			<a
				href="/explore?sort=likes"
				class="text-primary hover:text-primary/80 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
			>
				Ver todos →
			</a>
		</div>

		{#if links.length === 0}
			<div class="text-center py-12">
				<p class="text-gray-500 dark:text-gray-400">
					Aún no hay enlaces destacados. ¡Sé el primero en agregar uno!
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each links as link (link.id)}
					<LinkCard {link} />
				{/each}
			</div>
		{/if}
	</div>
</section>
