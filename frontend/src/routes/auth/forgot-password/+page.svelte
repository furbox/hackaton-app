<script lang="ts">
	import AuthFormWrapper from '$lib/components/auth/AuthFormWrapper.svelte';

	let { form } = $props<{
		form?: {
			error?: string;
			success?: boolean;
			message?: string;
			email?: string;
		};
	}>();

	let isLoading = $state(false);

	// Use $derived to reactively get email from form or default
	let email = $derived(form?.email || '');

	// Use $derived to reactively get submitted state from form
	let isSubmitted = $derived(form?.success ?? false);
</script>

<svelte:head>
	<title>Recuperar Contraseña - URLoft</title>
	<meta
		name="description"
		content="Restablece tu contraseña de URLoft mediante un email de recuperación."
	/>
</svelte:head>

<AuthFormWrapper title="Recupera tu contraseña">
	{#if isSubmitted}
		<div class="text-center">
			<div
				class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4"
			>
				<svg
					class="h-10 w-10 text-green-600 dark:text-green-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
				Email enviado
			</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
				{form?.message}
			</p>
			<div class="space-y-4">
				<p class="text-sm text-gray-500 dark:text-gray-500">
					Hemos enviado un email a <span class="font-medium">{email}</span>
					con las instrucciones para restablecer tu contraseña.
				</p>
				<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
					<p class="text-sm text-blue-800 dark:text-blue-200">
						<strong>¿No lo recibiste?</strong> Revisa tu carpeta de spam o solicita otro
						email de recuperación.
					</p>
				</div>
				<div class="flex flex-col space-y-3">
					<a
						href="/auth/forgot-password"
						class="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
					>
						Reenviar email
					</a>
					<a
						href="/auth/login"
						class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors"
					>
						Volver al login
					</a>
				</div>
			</div>
		</div>
	{:else}
		<form method="POST" action="?/requestReset" class="space-y-6">
			{#if form?.error}
				<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
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
							<p class="text-sm text-red-800 dark:text-red-200">{form.error}</p>
						</div>
					</div>
				</div>
			{/if}

			<div>
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
					Ingresa tu email y te enviaremos las instrucciones para restablecer tu contraseña.
				</p>
			</div>

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
						bind:value={email}
						class="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
					/>
				</div>
			</div>

			<div>
				<button
					type="submit"
					disabled={isLoading}
					class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{#if isLoading}
						Enviando...
					{:else}
						Enviar instrucciones
					{/if}
				</button>
			</div>

			<div class="text-center text-sm">
				<a
					href="/auth/login"
					class="font-medium text-primary hover:text-primary/80 dark:text-indigo-400 dark:hover:text-indigo-300"
				>
					Volver al login
				</a>
			</div>
		</form>
	{/if}
</AuthFormWrapper>
