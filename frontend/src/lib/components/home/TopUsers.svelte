<script lang="ts">
	import type { TopUserDTO } from '$lib/services/links.service';

	let { users = [] } = $props<{ users: TopUserDTO[] }>();

	const getRankBadgeColor = (rank: string) => {
		switch (rank.toLowerCase()) {
			case 'admin':
				return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
			case 'pro':
			case 'expert':
				return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
			case 'user':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
		}
	};
</script>

<section class="py-12 bg-white dark:bg-gray-800">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">
			Top Colaboradores
		</h2>

		{#if users.length === 0}
			<div class="text-center py-12">
				<p class="text-gray-500 dark:text-gray-400">
					Aún no hay colaboradores registrados.
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
				{#each users as user (user.id)}
					<a
						href="/u/{user.username}"
						class="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-indigo-500 hover:shadow-md transition-all"
					>
						{#if user.avatarUrl}
							<img
								src={user.avatarUrl}
								alt={user.username}
								class="w-12 h-12 rounded-full mr-4"
							/>
						{:else}
							<div class="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold mr-4 flex-shrink-0">
								{user.username.charAt(0).toUpperCase()}
							</div>
						{/if}
						<div class="flex-1 min-w-0">
							<p class="font-semibold text-gray-900 dark:text-white truncate">
								{user.username}
							</p>
							<div class="flex items-center mt-1 space-x-2">
								<span
									class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getRankBadgeColor(
										user.rank
									)}"
								>
									{user.rank}
								</span>
								<span class="text-xs text-gray-500 dark:text-gray-400">
									{user.linkCount} links
								</span>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</section>
