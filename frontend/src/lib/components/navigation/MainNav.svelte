<script lang="ts">
    import { session, ui } from '$lib/state';
    import { page } from '$app/state';

    const isActive = (path: string) => {
        if (path === '/') {
            return page.url.pathname === '/';
        }
        return page.url.pathname.startsWith(path);
    };
</script>

<nav class="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
            <div class="flex items-center">
                <a href="/" class="flex-shrink-0 flex items-center text-primary font-bold text-xl">
                    URLoft
                </a>
                <div class="hidden sm:ml-6 sm:flex sm:space-x-8 h-full">
                    <a href="/" 
                        class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium {isActive('/') ? 'border-primary text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}">
                        Home
                    </a>
                    <a href="/explore" 
                        class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium {isActive('/explore') ? 'border-primary text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}">
                        Explore
                    </a>
                    {#if session.isAuthenticated}
                        <a href="/dashboard" 
                            class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium {isActive('/dashboard') ? 'border-primary text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}">
                            Dashboard
                        </a>
                    {/if}
                </div>
            </div>
            
            <div class="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
                {#if session.isAuthenticated}
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                        Hola, <span class="font-semibold">{session.displayName}</span>!
                    </span>
                    <form method="POST" action="/auth/logout">
                        <button type="submit" class="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 cursor-pointer">
                            Logout
                        </button>
                    </form>
                {:else}
                    <a href="/auth/login" class="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                        Login
                    </a>
                    <a href="/auth/register" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors">
                        Register
                    </a>
                {/if}
            </div>

            <!-- Mobile menu button -->
            <div class="-mr-2 flex items-center sm:hidden">
                <button 
                    onclick={() => ui.toggleMobileMenu()}
                    class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary dark:hover:bg-gray-800"
                >
                    <span class="sr-only">Open main menu</span>
                    {#if !ui.mobileMenuOpen}
                        <svg class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    {:else}
                        <svg class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    {/if}
                </button>
            </div>
        </div>
    </div>

    <!-- Mobile menu -->
    {#if ui.mobileMenuOpen}
        <div class="sm:hidden">
            <div class="pt-2 pb-3 space-y-1">
                <a href="/" 
                    class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium {isActive('/') ? 'bg-primary/10 border-primary text-primary' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'}">
                    Home
                </a>
                <a href="/explore" 
                    class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium {isActive('/explore') ? 'bg-primary/10 border-primary text-primary' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'}">
                    Explore
                </a>
                {#if session.isAuthenticated}
                    <a href="/dashboard" 
                        class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium {isActive('/dashboard') ? 'bg-primary/10 border-primary text-primary' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'}">
                        Dashboard
                    </a>
                {/if}
            </div>
            <div class="pt-4 pb-3 border-t border-gray-200 dark:border-gray-800">
                {#if session.isAuthenticated}
                    <div class="flex items-center px-4">
                        <div class="flex-shrink-0">
                            <!-- Placeholder for avatar -->
                            <div class="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                                {session.displayName.charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div class="ml-3">
                            <div class="text-base font-medium text-gray-800 dark:text-white">{session.displayName}</div>
                        </div>
                    </div>
                    <div class="mt-3 space-y-1">
                        <form method="POST" action="/auth/logout">
                            <button type="submit" class="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800">
                                Logout
                            </button>
                        </form>
                    </div>
                {:else}
                    <div class="mt-3 space-y-1">
                        <a href="/auth/login" class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800">
                            Login
                        </a>
                        <a href="/auth/register" class="block px-4 py-2 text-base font-medium text-primary hover:bg-gray-100 dark:hover:bg-gray-800">
                            Register
                        </a>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</nav>
