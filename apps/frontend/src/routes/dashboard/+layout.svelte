<script lang="ts">
  import { onMount } from 'svelte';
  import { isAuthenticated } from '$lib/stores/auth';
  import { page } from '$app/stores';

  onMount(() => {
    if (!$isAuthenticated) {
      window.location.href = '/auth/login';
    }
  });

  if (!$isAuthenticated) {
    return;
  }
</script>

<nav class="bg-white shadow-sm border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16">
      <div class="flex">
        <div class="flex-shrink-0 flex items-center">
          <a href="/dashboard" class="text-xl font-bold text-gray-900">urloft.site</a>
        </div>
        <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
          <a
            href="/dashboard"
            class="inline-flex items-center px-1 pt-1 border-b-2 {($page.url.pathname === '/dashboard' ||
              $page.url.pathname === '/dashboard/links')
              ? 'border-blue-500 text-gray-900'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} text-sm font-medium"
          >
            Links
          </a>
          <a
            href="/dashboard/categories"
            class="inline-flex items-center px-1 pt-1 border-b-2 {$page.url.pathname ===
              '/dashboard/categories'
              ? 'border-blue-500 text-gray-900'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} text-sm font-medium"
          >
            Categories
          </a>
          <a
            href="/dashboard/profile"
            class="inline-flex items-center px-1 pt-1 border-b-2 {$page.url.pathname ===
              '/dashboard/profile'
              ? 'border-blue-500 text-gray-900'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} text-sm font-medium"
          >
            Profile
          </a>
        </div>
      </div>
      <div class="flex items-center">
        <a
          href="/"
          target="_blank"
          class="text-sm text-gray-600 hover:text-gray-900 mr-4"
        >
          View Site
        </a>
        <button
          on:click={() => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            window.location.href = '/';
          }}
          class="text-sm text-gray-600 hover:text-gray-900"
        >
          Logout
        </button>
      </div>
    </div>
  </div>
</nav>

<slot />
