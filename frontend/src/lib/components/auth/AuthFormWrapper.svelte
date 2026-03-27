<script lang="ts">
	import { ui } from '$lib/state';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		error?: string | null;
		loading?: boolean;
		children: Snippet;
	}

	let { title, error, loading = false, children }: Props = $props();
</script>

<div class="min-h-[calc(100vh-12rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8">
		<div class="text-center">
			<h2 class="text-3xl font-extrabold text-gray-900 dark:text-white">
				{title}
			</h2>
		</div>

		{#if error}
			<div class="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg
							class="h-5 w-5 text-red-400"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
						<div class="mt-2 text-sm text-red-700 dark:text-red-300">
							{error}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<div class="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 dark:bg-gray-800 {loading ? 'opacity-75 pointer-events-none' : ''}">
			{@render children()}
		</div>
	</div>
</div>
