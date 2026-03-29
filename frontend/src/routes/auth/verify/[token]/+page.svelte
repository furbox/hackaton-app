<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data } = $props<{
		success: boolean;
		message: string;
		invalidToken?: boolean;
	}>();

	let countdown = $state(5);

	onMount(() => {
		if (data.success) {
			const interval = setInterval(() => {
				countdown--;
				if (countdown <= 0) {
					clearInterval(interval);
					goto('/auth/login');
				}
			}, 1000);

			return () => clearInterval(interval);
		}
	});
</script>

<svelte:head>
	<title>Verificar Email - URLoft</title>
</svelte:head>

<div class="min-h-[calc(100vh-12rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full">
		<!-- Logo igual al nav -->
		<div class="text-center mb-8">
			<a href="/" class="inline-flex items-center text-primary font-bold text-3xl tracking-tight">
				urloft
			</a>
		</div>

		{#if data.success}
			<div class="text-center">
				<div
					class="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30"
				>
					<svg
						class="h-12 w-12 text-green-600 dark:text-green-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
				</div>
				<h2 class="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
					¡Email verificado!
				</h2>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					{data.message}
				</p>
				<p class="mt-4 text-sm text-gray-500 dark:text-gray-500">
					Redirigiendo al login en {countdown} segundos...
				</p>
				<a
					href="/auth/login"
					class="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90"
				>
					Ir al login ahora
				</a>
			</div>
		{:else}
			<div class="text-center">
				<div
					class="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 mb-2"
				>
					<svg
						class="h-12 w-12 text-red-600 dark:text-red-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</div>
				<h2 class="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
					Verificación fallida
				</h2>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					{data.message}
				</p>
				{#if data.invalidToken}
					<p class="mt-4 text-sm text-gray-500 dark:text-gray-500">
						El enlace de verificación es inválido o ha expirado.
					</p>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-500">
						Podés volver a registrarte con el mismo email para recibir un nuevo enlace de verificación.
					</p>
					<div class="mt-6 space-y-3">
						<a
							href="/auth/register"
							class="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90"
						>
							Crear cuenta y reenviar verificacion
						</a>
						<div>
							<a href="/auth/login" class="text-sm text-primary hover:text-primary/80">
								Volver al login
							</a>
						</div>
					</div>
				{:else}
					<a
						href="/auth/login"
						class="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90"
					>
						Volver al login
					</a>
				{/if}
			</div>
		{/if}
	</div>
</div>
