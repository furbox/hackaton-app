<script lang="ts">
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth';

  let mobileMenuOpen = false;

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

  $: isAuthenticated = !!$auth.token;
</script>

<nav class="bg-white shadow-md sticky top-0 z-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16">
      <div class="flex items-center">
        <a href="/" class="flex items-center">
          <span class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            urloft.site
          </span>
        </a>
      </div>

      <div class="hidden md:flex md:items-center md:space-x-6">
        <a
          href="/"
          class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
          on:click={closeMobileMenu}
        >
          Home
        </a>
        <a
          href="/stats"
          class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
          on:click={closeMobileMenu}
        >
          Stats
        </a>

        {#if isAuthenticated}
          <a
            href="/dashboard"
            class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            on:click={closeMobileMenu}
          >
            Dashboard
          </a>
          <a
            href="/dashboard/profile"
            class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            on:click={closeMobileMenu}
          >
            Profile
          </a>
          <button
            on:click={() => {
              $auth.logout();
              closeMobileMenu();
            }}
            class="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        {:else}
          <a
            href="/auth/login"
            class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            on:click={closeMobileMenu}
          >
            Sign In
          </a>
          <a
            href="/auth/register"
            class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            on:click={closeMobileMenu}
          >
            Get Started
          </a>
        {/if}
      </div>

      <div class="flex items-center md:hidden">
        <button
          on:click={toggleMobileMenu}
          class="text-gray-700 hover:text-blue-600 focus:outline-none focus:text-blue-600 p-2"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {#if mobileMenuOpen}
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            {:else}
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            {/if}
          </svg>
        </button>
      </div>
    </div>
  </div>

  {#if mobileMenuOpen}
    <div class="md:hidden bg-white border-t border-gray-200">
      <div class="px-2 pt-2 pb-3 space-y-1">
        <a
          href="/"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          on:click={closeMobileMenu}
        >
          Home
        </a>
        <a
          href="/stats"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          on:click={closeMobileMenu}
        >
          Stats
        </a>

        {#if isAuthenticated}
          <a
            href="/dashboard"
            class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            on:click={closeMobileMenu}
          >
            Dashboard
          </a>
          <a
            href="/dashboard/profile"
            class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            on:click={closeMobileMenu}
          >
            Profile
          </a>
          <button
            on:click={() => {
              $auth.logout();
              closeMobileMenu();
            }}
            class="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
          >
            Logout
          </button>
        {:else}
          <a
            href="/auth/login"
            class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            on:click={closeMobileMenu}
          >
            Sign In
          </a>
          <a
            href="/auth/register"
            class="block px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-blue-50"
            on:click={closeMobileMenu}
          >
            Get Started
          </a>
        {/if}
      </div>
    </div>
  {/if}
</nav>
