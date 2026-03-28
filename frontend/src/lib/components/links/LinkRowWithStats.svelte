<script lang="ts">
	import type { LinkDTO } from '$lib/services';
	import { enhance } from '$app/forms';

	interface Props {
		link: LinkDTO & {
			likesCount: number;
			favoritesCount: number;
		};
	}

	let { link }: Props = $props();

	let isDeleting = $state(false);
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 min-w-0">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
				{link.title}
			</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
				{link.url}
			</p>
			{#if link.description}
				<p class="text-sm text-gray-500 dark:text-gray-500 mt-2 line-clamp-2">
					{link.description}
				</p>
			{/if}
			<div class="flex items-center gap-4 mt-3">
				<div class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
					<span>👁️</span>
					<span>{link.views}</span>
				</div>
				<div class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
					<span>❤️</span>
					<span>{link.likesCount}</span>
				</div>
				<div class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
					<span>⭐</span>
					<span>{link.favoritesCount}</span>
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-2">
			<a
				href="/dashboard/links/{link.id}"
				class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
			>
				<span>📊</span>
				<span>Stats</span>
			</a>
			<button class="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Editar">
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
				</svg>
			</button>
			<form method="POST" action="?/deleteLink" use:enhance={() => {
				return async ({ cancel }) => {
					if (isDeleting) {
						cancel();
						return;
					}
					if (!confirm('¿Estás seguro de que quieres eliminar este link?')) {
						cancel();
						return;
					}
					isDeleting = true;
				};
			}}>
				<input type="hidden" name="id" value={link.id} />
				<button
					type="submit"
					disabled={isDeleting}
					class="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					title="Eliminar"
				>
					{#if isDeleting}
						<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					{:else}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
					{/if}
				</button>
			</form>
		</div>
	</div>
</div>

<!--
	USAGE EXAMPLE:
	
	1. In your links list page (e.g., +page.svelte):
	
	<script lang="ts">
		import LinkRow from '$lib/components/links/LinkRowWithStats.svelte';
		import type { PageData } from './$types';
		
		export let data: PageData;
	</script>
	
	{#each data.links as link}
		<LinkRow {link} />
	{/each}
	
	2. In your +page.server.ts or +layout.server.ts:
	
	import { linksService } from '$lib/services';
	
	export const load = async ({ fetch, cookies }) => {
		const response = await linksService.getLinksMe({}, { fetch, cookies });
		
		return {
			links: response.data.links
		};
	};
-->
