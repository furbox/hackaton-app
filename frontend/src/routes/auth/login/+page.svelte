<script lang="ts">
	import AuthFormWrapper from '$lib/components/auth/AuthFormWrapper.svelte';
	import { applyAction, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { form } = $props<{
		form?: {
			error?: string;
			errorCode?: string;
			email?: string;
		};
	}>();

	let password = $state('');
	let isLoading = $state(false);

	const enhanceLogin: SubmitFunction = () => {
		isLoading = true;

		return async ({ result }) => {
			if (result.type === 'redirect') {
				isLoading = false;
				await goto(result.location, {
					replaceState: true,
					invalidateAll: true
				});
				return;
			}

			isLoading = false;
			await applyAction(result);
		};
	};
</script>

<svelte:head>
	<title>Iniciar Sesión - URLoft</title>
	<meta name="description" content="Inicia sesión en URLoft para acceder a tus enlaces." />
</svelte:head>

<AuthFormWrapper title="Inicia sesión">
	<form method="POST" action="?/login" class="space-y-6" use:enhance={enhanceLogin}>
		{#if isLoading}
			<div
				class="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-100"
				role="status"
				aria-live="polite"
			>
				Validando tus credenciales...
			</div>
		{/if}

		{#if form?.error}
			<div
				class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"
				role="alert"
				aria-live="assertive"
			>
				<div class="flex">
					<div class="flex-shrink-0">
						<svg
							class="h-5 w-5 text-red-400"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div class="ml-3">
						{#if form.errorCode === 'EMAIL_NOT_VERIFIED'}
							<p class="text-sm text-red-800 dark:text-red-200 font-medium">
								Necesitas verificar tu email para continuar.
							</p>
						{/if}
						<p class="text-sm text-red-800 dark:text-red-200">{form.error}</p>
					</div>
				</div>
			</div>
		{/if}

		<div>
			<label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
				Email
			</label>
			<div class="mt-1">
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					value={form?.email ?? ''}
					class="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
				/>
			</div>
		</div>

		<div>
			<label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
				Contraseña
			</label>
			<div class="mt-1">
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					bind:value={password}
					class="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
				/>
			</div>
		</div>

		<div class="flex items-center justify-between">
			<div class="flex items-center">
				<input
					id="remember-me"
					name="remember-me"
					type="checkbox"
					class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
				/>
				<label for="remember-me" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">
					Recordarme
				</label>
			</div>

			<div class="text-sm">
				<a
					href="/auth/forgot-password"
					class="font-medium text-primary hover:text-primary/80 dark:text-indigo-400 dark:hover:text-indigo-300"
				>
					¿Olvidaste tu contraseña?
				</a>
			</div>
		</div>

		<div>
			<button
				type="submit"
				disabled={isLoading}
				class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{#if isLoading}
					Iniciando sesion...
				{:else}
					Iniciar sesión
				{/if}
			</button>
		</div>

		<div class="text-center text-sm">
			<span class="text-gray-600 dark:text-gray-400">¿No tienes cuenta?</span>
			<a
				href="/auth/register"
				class="font-medium text-primary hover:text-primary/80 dark:text-indigo-400 dark:hover:text-indigo-300 ml-1"
			>
				Regístrate gratis
			</a>
		</div>
	</form>
</AuthFormWrapper>
