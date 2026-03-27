<script lang="ts">
	import type { PublicProfileResponse } from '$lib/services/profile.service';

	let { user } = $props<{ user: PublicProfileResponse }>();

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

<div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
	<div class="bg-gradient-to-r from-indigo-500 to-purple-600 h-32"></div>
	<div class="px-6 pb-6">
		<div class="flex flex-col sm:flex-row items-center sm:items-end -mt-16 mb-6">
			{#if user.avatarUrl}
				<img
					src={user.avatarUrl}
					alt={user.username}
					class="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 shadow-lg object-cover"
				/>
			{:else}
				<div
					class="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 shadow-lg bg-primary flex items-center justify-center text-white text-4xl font-bold"
				>
					{user.username.charAt(0).toUpperCase()}
				</div>
			{/if}

			<div class="mt-4 sm:mt-0 sm:ml-6 flex-1 text-center sm:text-left">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
							{user.name || user.username}
						</h1>
						<p class="text-lg text-gray-600 dark:text-gray-400">@{user.username}</p>
					</div>
					<span
						class="mt-2 sm:mt-0 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium {getRankBadgeColor(
							user.rank
						)}"
					>
						{user.rank}
					</span>
				</div>

				{#if user.bio}
					<p class="mt-3 text-gray-700 dark:text-gray-300 max-w-2xl">
						{user.bio}
					</p>
				{/if}
			</div>
		</div>

		<!-- Stats -->
		<div class="grid grid-cols-3 gap-4 border-t border-gray-200 dark:border-gray-700 pt-6">
			<div class="text-center">
				<div class="text-2xl font-bold text-gray-900 dark:text-white">
					{user.stats.totalLinks}
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">Links</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold text-gray-900 dark:text-white">
					{user.stats.totalLikes}
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">Likes</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold text-gray-900 dark:text-white">
					{user.stats.totalViews}
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">Vistas</div>
			</div>
		</div>
	</div>
</div>
