<script lang="ts">
	import { ui } from '$lib/state';
	import { fade, fly } from 'svelte/transition';

	interface Toast {
		id: string;
		message: string;
		type: 'info' | 'success' | 'error';
	}

	const typeIcons: Record<string, string> = {
		info: 'ℹ️',
		success: '✅',
		error: '❌'
	};

	const typeColors: Record<string, string> = {
		info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100',
		success: 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100',
		error: 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100'
	};
</script>

{#if ui.toasts.length > 0}
	<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
		{#each ui.toasts as toast (toast.id)}
			<div
				class="flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 shadow-lg max-w-md {typeColors[toast.type]}"
				in:fly={{ y: 50, duration: 300 }}
				out:fade={{ duration: 300 }}
				role="alert"
			>
				<span class="text-xl" aria-hidden="true">{typeIcons[toast.type]}</span>
				<p class="flex-1 text-sm font-medium">{toast.message}</p>
				<button
					type="button"
					onclick={() => ui.removeToast(toast.id)}
					class="text-current opacity-60 hover:opacity-100 transition-opacity"
					aria-label="Close notification"
				>
					✕
				</button>
			</div>
		{/each}
	</div>
{/if}
