<script lang="ts">
	interface Props {
		count?: number;
	}

	let { count = 1 }: Props = $props();
</script>

{#each Array(count) as _, i}
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 animate-pulse" role="status" aria-label="Loading">
		<div class="space-y-3">
			<div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
			<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
			<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
			<div class="flex gap-2 mt-4">
				<div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
				<div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
			</div>
		</div>
	</div>
{/each}
