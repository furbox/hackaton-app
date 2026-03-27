<script lang="ts">
	import { page } from '$app/state';
</script>

<section class="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 overflow-hidden">
	<div class="absolute inset-0">
		<div
			class="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"
		></div>
	</div>

	<div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
		<div class="text-center">
			<h1
				class="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-6"
			>
				Tus enlaces,
				<br />
				<span class="text-yellow-300">organizados y a mano</span>
			</h1>
			<p
				class="mt-4 max-w-2xl mx-auto text-xl text-indigo-100 dark:text-indigo-200"
			>
				URLoft es tu gestor de enlaces personal. Guarda, organiza y comparte tus links favoritos
				con una comunidad de desarrolladores y entusiastas de la tecnología.
			</p>
			<div class="mt-10 flex flex-col sm:flex-row justify-center gap-4">
				<a
					href="/auth/register"
					class="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-indigo-600 bg-white hover:bg-indigo-50 md:text-lg md:px-10 transition-colors shadow-lg"
				>
					Crear cuenta gratis
				</a>
				<a
					href="/explore"
					class="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-700 hover:bg-indigo-800 md:text-lg md:px-10 transition-colors"
				>
					Explorar enlaces
				</a>
			</div>
		</div>

		<!-- Feature highlights -->
		<div class="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3 max-w-4xl mx-auto">
			<div class="text-center">
				<div
					class="flex items-center justify-center w-12 h-12 mx-auto rounded-lg bg-indigo-500 text-white mb-4"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
						/>
					</svg>
				</div>
				<h3 class="text-lg font-semibold text-white mb-2">Enlaces cortos</h3>
				<p class="text-indigo-100 text-sm">Comparte links de forma elegante y memorable</p>
			</div>

			<div class="text-center">
				<div
					class="flex items-center justify-center w-12 h-12 mx-auto rounded-lg bg-purple-500 text-white mb-4"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
						/>
					</svg>
				</div>
				<h3 class="text-lg font-semibold text-white mb-2">Categorías</h3>
				<p class="text-indigo-100 text-sm">Organiza tus links por temas e intereses</p>
			</div>

			<div class="text-center">
				<div
					class="flex items-center justify-center w-12 h-12 mx-auto rounded-lg bg-pink-500 text-white mb-4"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
						/>
					</svg>
				</div>
				<h3 class="text-lg font-semibold text-white mb-2">Comunidad</h3>
				<p class="text-indigo-100 text-sm">Descubre lo que otros están compartiendo</p>
			</div>
		</div>
	</div>
</section>
