<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import MainNav from '$lib/components/navigation/MainNav.svelte';
	import { session } from '$lib/stores/session';
	import { onMount } from 'svelte';

	let { data, children } = $props<{
		data: {
			session: {
				user: {
					id: number;
					username: string;
					email: string;
					avatarUrl: string | null;
					rank: string;
				} | null;
				token: string | null;
			} | null;
		} | null;
	}>();

	// Hydrate session store from server data on mount
	onMount(() => {
		session.hydrate(data?.session || null);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>URLoft - Tus enlaces en la nube</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 font-sans antialiased text-gray-900 dark:text-gray-100">
	<MainNav />

	<main class="flex-grow">
		{@render children()}
	</main>

	<footer class="bg-white border-t border-gray-200 py-8 dark:bg-gray-900 dark:border-gray-800">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
				<div class="text-sm text-gray-500 dark:text-gray-400">
					&copy; {new Date().getFullYear()} URLoft. Hecho con ❤️ para el Hackathon 2026.
				</div>
				<div class="flex space-x-6">
					<a
						href="/privacy"
						class="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
					>
						Privacidad
					</a>
					<a
						href="/terms"
						class="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
					>
						Términos
					</a>
					<a
						href="https://github.com/urloft"
						class="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
				</div>
			</div>
		</div>
	</footer>
</div>
