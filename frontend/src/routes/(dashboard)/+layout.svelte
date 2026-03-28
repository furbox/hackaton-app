<script lang="ts">
	import Sidebar from '$lib/components/dashboard/Sidebar.svelte';
	import Topbar from '$lib/components/dashboard/Topbar.svelte';
	import { session } from '$lib/state';

	let { children } = $props();
	// Redirect is handled server-side by +layout.ts (throw redirect(302, ...)).
	// The $effect + goto() was removed: it caused N dangling subscriptions on HMR
	// because the module-level singleton is never hot-reloaded, leading to heap OOM.
</script>

{#if session.isAuthenticated}
	<div class="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 font-sans antialiased text-gray-900 dark:text-gray-100">
		<Sidebar />
		
		<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
			<Topbar />
			
			<main class="flex-1 relative overflow-y-auto focus:outline-none">
				<div class="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
					{@render children()}
				</div>
			</main>
		</div>
	</div>
{:else}
	<!-- Loader mientras se resuelve el estado o se ejecuta el redirect de +layout.ts -->
	<div class="h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
		<div class="relative w-16 h-16">
			<div class="absolute top-0 left-0 w-full h-full border-4 border-primary/20 rounded-full"></div>
			<div class="absolute top-0 left-0 w-full h-full border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
		</div>
		<p class="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
			Cargando tu panel...
		</p>
	</div>
{/if}
