<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	export let data: PageData;

	let activeTab = 'views';
	const tabs = [
		{ id: 'views', label: 'Vistas', icon: '👁️' },
		{ id: 'likes', label: 'Likes', icon: '❤️' },
		{ id: 'favorites', label: 'Favoritos', icon: '⭐' }
	];

	function anonymizeIP(ip: string): string {
		if (!ip || ip === 'unknown') return 'Desconocido';
		const parts = ip.split('.');
		if (parts.length === 4) {
			return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
		}
		return ip;
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('es-ES', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function truncateUserAgent(ua: string): string {
		if (!ua) return 'Unknown';
		if (ua.length > 60) {
			return ua.substring(0, 60) + '...';
		}
		return ua;
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
	<div class="max-w-6xl mx-auto">
		<!-- Header with navigation -->
		<div class="mb-8">
			<a
				href="/dashboard/links"
				class="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
				Volver a mis links
			</a>
		</div>

		<!-- Link Info Header -->
		<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-6 border border-gray-200 dark:border-gray-700">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
				Estadísticas del Link #{data.details.linkId}
			</h1>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<!-- Views Card -->
				<div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
					<div class="flex items-center justify-between mb-2">
						<span class="text-2xl">👁️</span>
						<span class="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide"
							>Vistas</span
						>
					</div>
					<div class="text-4xl font-bold text-blue-700 dark:text-blue-300">
						{data.details.totalViews}
					</div>
				</div>

				<!-- Likes Card -->
				<div class="bg-gradient-to-br from-red-50 to-pink-100 dark:from-red-900/20 dark:to-pink-800/20 rounded-xl p-6 border border-red-200 dark:border-red-800">
					<div class="flex items-center justify-between mb-2">
						<span class="text-2xl">❤️</span>
						<span class="text-sm font-medium text-red-600 dark:text-red-400 uppercase tracking-wide"
							>Likes</span
						>
					</div>
					<div class="text-4xl font-bold text-red-700 dark:text-red-300">
						{data.details.totalLikes}
					</div>
				</div>

				<!-- Favorites Card -->
				<div class="bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/20 dark:to-amber-800/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800">
					<div class="flex items-center justify-between mb-2">
						<span class="text-2xl">⭐</span>
						<span class="text-sm font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wide"
							>Favoritos</span
						>
					</div>
					<div class="text-4xl font-bold text-yellow-700 dark:text-yellow-300">
						{data.details.totalFavorites}
					</div>
				</div>
			</div>
		</div>

		<!-- Tabs Navigation -->
		<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
			<div class="border-b border-gray-200 dark:border-gray-700">
				<nav class="flex divide-x divide-gray-200 dark:divide-gray-700">
					{#each tabs as tab}
						<button
							on:click={() => (activeTab = tab.id)}
							class="flex-1 px-6 py-4 text-center font-medium transition-all duration-200 {activeTab === tab.id
								? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-b-2 border-indigo-600'
								: 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50'}"
						>
							<span class="mr-2">{tab.icon}</span>
							{tab.label}
						</button>
					{/each}
				</nav>
			</div>

			<!-- Tab Content -->
			<div class="p-6">
				{#if activeTab === 'views'}
					<!-- Views Tab -->
					<div class="space-y-4">
						<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
							Historial de Vistas
						</h2>
						{#if data.details.views.length === 0}
							<div class="text-center py-12">
								<span class="text-6xl mb-4 block">👁️</span>
								<p class="text-gray-600 dark:text-gray-400 text-lg">
									No hay vistas registradas aún
								</p>
							</div>
						{:else}
							<div class="overflow-x-auto">
								<table class="w-full">
									<thead>
										<tr class="border-b border-gray-200 dark:border-gray-700">
											<th class="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
												Fecha
											</th>
											<th class="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
												IP (Anonimizada)
											</th>
											<th class="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
												User Agent
											</th>
										</tr>
									</thead>
									<tbody>
										{#each data.details.views as view}
											<tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
												<td class="py-3 px-4 text-sm text-gray-900 dark:text-white">
													{formatDate(view.visitedAt)}
												</td>
												<td class="py-3 px-4">
													<code class="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300 font-mono">
														{anonymizeIP(view.ipAddress)}
													</code>
												</td>
												<td class="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
													{truncateUserAgent(view.userAgent)}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				{:else if activeTab === 'likes'}
					<!-- Likes Tab -->
					<div class="space-y-4">
						<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
							Usuarios que dieron Like
						</h2>
						{#if data.details.likes.length === 0}
							<div class="text-center py-12">
								<span class="text-6xl mb-4 block">❤️</span>
								<p class="text-gray-600 dark:text-gray-400 text-lg">
									No hay likes aún
								</p>
							</div>
						{:else}
							<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{#each data.details.likes as user}
									<div class="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800 hover:shadow-md transition-shadow">
										<div class="flex items-center gap-3">
											<div class="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
												{user.username.charAt(0).toUpperCase()}
											</div>
											<div class="flex-1 min-w-0">
												<div class="font-semibold text-gray-900 dark:text-white truncate">
													{user.username}
												</div>
												<div class="text-sm text-gray-600 dark:text-gray-400">
													{formatDate(user.createdAt)}
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{:else if activeTab === 'favorites'}
					<!-- Favorites Tab -->
					<div class="space-y-4">
						<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
							Usuarios que guardaron en Favoritos
						</h2>
						{#if data.details.favorites.length === 0}
							<div class="text-center py-12">
								<span class="text-6xl mb-4 block">⭐</span>
								<p class="text-gray-600 dark:text-gray-400 text-lg">
									No hay favoritos aún
								</p>
							</div>
						{:else}
							<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{#each data.details.favorites as user}
									<div class="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800 hover:shadow-md transition-shadow">
										<div class="flex items-center gap-3">
											<div class="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
												{user.username.charAt(0).toUpperCase()}
											</div>
											<div class="flex-1 min-w-0">
												<div class="font-semibold text-gray-900 dark:text-white truncate">
													{user.username}
												</div>
												<div class="text-sm text-gray-600 dark:text-gray-400">
													{formatDate(user.createdAt)}
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
