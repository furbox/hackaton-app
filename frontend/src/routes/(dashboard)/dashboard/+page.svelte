<script lang="ts">
	import { session } from '$lib/state';
</script>

<div class="space-y-6">
	<div class="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
		<div>
			<h1 class="text-3xl font-extrabold text-gray-900 dark:text-white sm:truncate">
				¡Hola de nuevo, {session.displayName}!
			</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				Resumen rápido de tu actividad en URLoft.
			</p>
		</div>
		<div class="flex space-x-3">
			<button class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors cursor-pointer">
				+ Nuevo Link
			</button>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
		<div class="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0 bg-blue-500/10 p-3 rounded-lg text-blue-600 text-xl">
						🔗
					</div>
					<div class="ml-5 w-0 flex-1 text-right">
						<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Total Links</dt>
						<dd class="text-2xl font-bold text-gray-900 dark:text-white">124</dd>
					</div>
				</div>
			</div>
		</div>

		<div class="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0 bg-red-500/10 p-3 rounded-lg text-red-600 text-xl">
						❤️
					</div>
					<div class="ml-5 w-0 flex-1 text-right">
						<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Likes Recibidos</dt>
						<dd class="text-2xl font-bold text-gray-900 dark:text-white">852</dd>
					</div>
				</div>
			</div>
		</div>

		<div class="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0 bg-green-500/10 p-3 rounded-lg text-green-600 text-xl">
						👁️
					</div>
					<div class="ml-5 w-0 flex-1 text-right">
						<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Vistas Totales</dt>
						<dd class="text-2xl font-bold text-gray-900 dark:text-white">12.4k</dd>
					</div>
				</div>
			</div>
		</div>

		<div class="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0 bg-yellow-500/10 p-3 rounded-lg text-yellow-600 text-xl">
						🏆
					</div>
					<div class="ml-5 w-0 flex-1 text-right">
						<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Rango Actual</dt>
						<dd class="text-2xl font-bold text-gray-900 dark:text-white uppercase">{session.user?.rank ?? 'pro'}</dd>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="mt-8 bg-white shadow-sm rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-800 p-12 text-center">
		<div class="flex flex-col items-center">
			<div class="text-gray-300 dark:text-gray-700 mb-4">
				<svg class="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
				</svg>
			</div>
			<p class="text-gray-500 dark:text-gray-400 max-w-sm">
				Estadísticas detalladas y links recientes estarán disponibles aquí en la siguiente fase de desarrollo.
			</p>
		</div>
	</div>
</div>
