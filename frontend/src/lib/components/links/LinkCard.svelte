<script lang="ts">
	import type { LinkListItemDTO } from '$lib/services/links.service';
	import { page } from '$app/state';

	let { link } = $props<{ link: LinkListItemDTO }>();

	const baseUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3000';
	const shortUrl = $derived(`${baseUrl}/s/${link.shortCode}`);

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Hoy';
		if (diffDays === 1) return 'Ayer';
		if (diffDays < 7) return `Hace ${diffDays} días`;
		if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
		if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
		return `Hace ${Math.floor(diffDays / 365)} años`;
	};
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden border border-gray-200 dark:border-gray-700">
	<div class="p-6">
		<div class="flex items-start justify-between">
			<div class="flex-1 min-w-0">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
					{link.title}
				</h3>
				{#if link.description}
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
						{link.description}
					</p>
				{/if}
			</div>
			{#if link.category}
				<span
					class="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
					style="background-color: {link.category.color}20; color: {link.category.color}"
				>
					{link.category.name}
				</span>
			{/if}
		</div>

		<div class="mt-4">
			<a
				href={shortUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="text-sm text-primary hover:text-primary/80 dark:text-indigo-400 dark:hover:text-indigo-300 line-clamp-1"
			>
				{link.url}
			</a>
		</div>

		<div class="mt-4 flex items-center justify-between">
			<div class="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
				<span class="flex items-center" title="Vistas">
					<svg
						class="w-4 h-4 mr-1"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
						/>
					</svg>
					{link.views}
				</span>
				<span class="flex items-center" title="Likes">
					<svg
						class="w-4 h-4 mr-1"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
						/>
					</svg>
					{link.likesCount}
				</span>
			</div>

			<span class="text-xs text-gray-400 dark:text-gray-500">
				{formatDate(link.createdAt)}
			</span>
		</div>

		{#if link.owner}
			<div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
				<a
					href="/u/{link.owner.username}"
					class="flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
				>
					{#if link.owner.avatarUrl}
						<img
							src={link.owner.avatarUrl}
							alt={link.owner.username}
							class="w-6 h-6 rounded-full mr-2"
						/>
					{:else}
						<div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs mr-2">
							{link.owner.username.charAt(0).toUpperCase()}
						</div>
					{/if}
					<span>@{link.owner.username}</span>
				</a>
			</div>
		{/if}
	</div>
</div>
