<script lang="ts">
	import AuthFormWrapper from '$lib/components/auth/AuthFormWrapper.svelte';

	let { data, form } = $props<{
		token: string;
		form?: {
			error?: string;
		};
	}>();

	let password = $state('');
	let confirmPassword = $state('');
	let isLoading = $state(false);

	let errors = $state<{
		password?: string;
		confirmPassword?: string;
	}>({});
</script>

<svelte:head>
	<title>Restablecer Contraseña - URLoft</title>
	<meta
		name="description"
		content="Crea una nueva contraseña para tu cuenta de URLoft."
	/>
</svelte:head>

<AuthFormWrapper title="Restablece tu contraseña">
	<form method="POST" action="?/resetPassword" class="space-y-6">
		<input type="hidden" name="token" value={data.token} />

		{#if form?.error}
			<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm text-red-800 dark:text-red-200">{form.error}</p>
						{#if form.error.includes('inválido') || form.error.includes('expirado')}
							<a
								href="/auth/forgot-password"
								class="text-sm underline text-red-700 dark:text-red-300"
							>
								Solicitar un nuevo email de recuperación
							</a>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<div>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				Ingresa tu nueva contraseña. Asegúrate de que sea segura y diferente a la anterior.
			</p>
		</div>

		<div>
			<label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
				Nueva contraseña
			</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				required
				bind:value={password}
				class="mt-1 appearance-none block w-full px-3 py-2 border {errors.password
					? 'border-red-300 focus:ring-red-500 focus:border-red-500'
					: 'border-gray-300 dark:border-gray-600 focus:ring-primary focus:border-primary'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
				aria-invalid={errors.password ? 'true' : undefined}
			/>
			{#if errors.password}
				<p class="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
			{:else}
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Mínimo 8 caracteres</p>
			{/if}
		</div>

		<div>
			<label
				for="confirmPassword"
				class="block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Confirmar nueva contraseña
			</label>
			<input
				id="confirmPassword"
				name="confirmPassword"
				type="password"
				autocomplete="new-password"
				required
				bind:value={confirmPassword}
				class="mt-1 appearance-none block w-full px-3 py-2 border {errors.confirmPassword
					? 'border-red-300 focus:ring-red-500 focus:border-red-500'
					: 'border-gray-300 dark:border-gray-600 focus:ring-primary focus:border-primary'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
				aria-invalid={errors.confirmPassword ? 'true' : undefined}
			/>
			{#if errors.confirmPassword}
				<p class="mt-1 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
			{/if}
		</div>

		<div>
			<button
				type="submit"
				disabled={isLoading}
				class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{#if isLoading}
					Restableciendo...
				{:else}
					Restablecer contraseña
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
</AuthFormWrapper>
