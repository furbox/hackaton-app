<script lang="ts">
	import AuthFormWrapper from '$lib/components/auth/AuthFormWrapper.svelte';

	let { form } = $props<{
		form?: {
			success?: boolean;
			message?: string;
			error?: string;
			data?: {
				username?: string;
				email?: string;
			};
		};
	}>();

	let isSuccess = $derived(Boolean(form?.success));
	let successMessage = $derived(
		form?.success
			? (form.message ??
					'Tu cuenta fue creada correctamente. Revisa tu email y hace click en el enlace de verificación para activar tu cuenta.')
			: ''
	);
	let showServerError = $derived(!isSuccess && Boolean(form?.error));

	// Use $derived to reactively get values from form or defaults
	let username = $derived(form?.data?.username || '');
	let email = $derived(form?.data?.email || '');
	let password = $state('');
	let confirmPassword = $state('');
	let isLoading = $state(false);

	let errors = $state<{
		username?: string;
		email?: string;
		password?: string;
		confirmPassword?: string;
	}>({});

	const validateEmail = (email: string) => {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	};

	const validateUsername = (username: string) => {
		return /^[a-zA-Z0-9_]{3,20}$/.test(username);
	};

	const handleSubmit = () => {
		errors = {};

		if (!validateEmail(email)) errors.email = 'Email inválido';
		if (!validateUsername(username))
			errors.username =
				'El usuario debe tener entre 3 y 20 caracteres, solo letras, números y _';
		if (password.length < 8) errors.password = 'Mínimo 8 caracteres';
		if (password !== confirmPassword) errors.confirmPassword = 'Las contraseñas no coinciden';

		if (Object.keys(errors).length > 0) {
			return false;
		}

		isLoading = true;
		return true;
	};
</script>

<svelte:head>
	<title>Registro - URLoft</title>
	<meta name="description" content="Crea tu cuenta en URLoft y empieza a organizar tus enlaces." />
</svelte:head>

<AuthFormWrapper title="Crea tu cuenta">
	{#if isSuccess}
		<div
			class="space-y-5 rounded-md border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-900/20"
			role="status"
			aria-live="polite"
		>
			<div class="flex items-start gap-3">
				<svg class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
						clip-rule="evenodd"
					/>
				</svg>
				<div class="space-y-2">
					<h2 class="text-base font-semibold text-emerald-900 dark:text-emerald-100">
						Registro exitoso
					</h2>
					<p class="text-sm text-emerald-800 dark:text-emerald-200">{successMessage}</p>
					<p class="text-sm text-emerald-800 dark:text-emerald-200">
						Siguiente paso: abrí tu email y confirmá tu cuenta desde el enlace de verificación.
					</p>
				</div>
			</div>

			<div class="flex flex-col gap-3 sm:flex-row">
				<a
					href="/auth/login"
					class="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:w-auto"
				>
					Ir a iniciar sesión
				</a>
				<a
					href="/auth/forgot-password"
					class="inline-flex w-full items-center justify-center rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:border-emerald-700 dark:bg-transparent dark:text-emerald-300 dark:hover:bg-emerald-900/30 sm:w-auto"
				>
					No me llegó el email
				</a>
			</div>
		</div>
	{:else}
		<form method="POST" action="?/register" class="space-y-4" onsubmit={handleSubmit}>
			{#if showServerError}
				<div
					class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"
					role="alert"
					aria-live="assertive"
				>
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
							<p class="text-sm text-red-800 dark:text-red-200">{form?.error}</p>
						</div>
					</div>
				</div>
			{/if}

		<div>
			<label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
				Usuario
			</label>
			<div class="mt-1 relative rounded-md shadow-sm">
				<span
					class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 dark:text-gray-400"
				>
					@
				</span>
				<input
					id="username"
					name="username"
					type="text"
					autocomplete="username"
					required
					bind:value={username}
					class="pl-7 appearance-none block w-full px-3 py-2 border {errors.username
						? 'border-red-300 focus:ring-red-500 focus:border-red-500'
						: 'border-gray-300 dark:border-gray-600 focus:ring-primary focus:border-primary'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
					aria-invalid={errors.username ? 'true' : undefined}
				/>
			</div>
			{#if errors.username}
				<p class="mt-1 text-sm text-red-600 dark:text-red-400">{errors.username}</p>
			{:else}
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					3-20 caracteres, solo letras, números y _
				</p>
			{/if}
		</div>

		<div>
			<label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
				Email
			</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
				bind:value={email}
				class="mt-1 appearance-none block w-full px-3 py-2 border {errors.email
					? 'border-red-300 focus:ring-red-500 focus:border-red-500'
					: 'border-gray-300 dark:border-gray-600 focus:ring-primary focus:border-primary'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
				aria-invalid={errors.email ? 'true' : undefined}
			/>
			{#if errors.email}
				<p class="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
			{/if}
		</div>

		<div>
			<label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
				Contraseña
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
				Confirmar contraseña
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
					Creando cuenta...
				{:else}
					Crear cuenta
				{/if}
			</button>
		</div>

			<div class="text-center text-sm">
				<span class="text-gray-600 dark:text-gray-400">¿Ya tienes cuenta?</span>
				<a
					href="/auth/login"
					class="font-medium text-primary hover:text-primary/80 dark:text-indigo-400 dark:hover:text-indigo-300 ml-1"
				>
					Inicia sesión
				</a>
			</div>
		</form>
	{/if}
</AuthFormWrapper>
