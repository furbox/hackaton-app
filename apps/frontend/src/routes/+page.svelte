<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import LinkCard from '$lib/components/LinkCard.svelte';

  interface PublicLink {
    id: number;
    name: string;
    url: string;
    short_code: string;
    short_url: string;
    views_count: number;
    likes_count: number;
    saves_count: number;
    created_at: string;
    user_id: number;
    is_public: number;
  }

  let featuredLinks: PublicLink[] = [];
  let loading = true;
  let error = '';

  async function loadFeaturedLinks() {
    try {
      const response = await api.get<{ data: PublicLink[] }>('/api/links/public?limit=6');
      featuredLinks = response.data;
    } catch (err: any) {
      error = err.message || 'Failed to load featured links';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadFeaturedLinks();
  });
</script>

<svelte:head>
  <title>urloft.site - Shorten, Share, and Track Your Links</title>
  <meta
    name="description"
    content="Free link management platform. Create short URLs, organize with categories, track analytics, and earn badges."
  />
  <meta name="keywords" content="link shortener, URL shortener, link management, analytics, short links" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div class="text-center">
      <h1
        class="text-5xl font-extrabold text-gray-900 sm:text-6xl md:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600"
      >
        urloft.site
      </h1>
      <p class="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
        Shorten, share, and track your links with powerful analytics and social features
      </p>
      <div class="mt-8 flex justify-center gap-4">
        <a
          href="/auth/register"
          class="px-8 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-lg"
        >
          Get Started Free
        </a>
        <a
          href="/auth/login"
          class="px-8 py-3 rounded-lg bg-white text-blue-600 font-semibold hover:bg-gray-50 transition-colors shadow-lg border border-gray-200"
        >
          Sign In
        </a>
      </div>
    </div>

    <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="bg-white rounded-xl p-6 shadow-lg">
        <div class="text-blue-600 mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Short URLs</h3>
        <p class="text-gray-600">
          Create memorable short links that redirect to any URL. Perfect for social media and marketing.
        </p>
      </div>

      <div class="bg-white rounded-xl p-6 shadow-lg">
        <div class="text-blue-600 mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Analytics</h3>
        <p class="text-gray-600">
          Track views, likes, and saves on your links. See what's performing best with detailed stats.
        </p>
      </div>

      <div class="bg-white rounded-xl p-6 shadow-lg">
        <div class="text-blue-600 mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Earn Badges</h3>
        <p class="text-gray-600">
          Level up from Iron to Diamond as you create more public links. Showcase your achievements.
        </p>
      </div>
    </div>

    <div class="mt-16">
      <div class="text-center mb-8">
        <h2 class="text-3xl font-bold text-gray-900">Featured Links</h2>
        <p class="mt-2 text-gray-600">Check out what's trending on the platform</p>
      </div>

      {#if loading}
        <div class="text-center py-12">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="mt-2 text-gray-600">Loading featured links...</p>
        </div>
      {:else if error}
        <div class="bg-red-50 border border-red-200 rounded-md p-4 text-center">
          <p class="text-red-800">{error}</p>
        </div>
      {:else if featuredLinks.length === 0}
        <div class="text-center py-12 bg-white rounded-lg">
          <svg
            class="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No links yet</h3>
          <p class="mt-1 text-sm text-gray-500">Be the first to create a public link!</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each featuredLinks as link}
            <LinkCard {link} />
          {/each}
        </div>
      {/if}
    </div>

    <div class="mt-16 text-center">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Ready to get started?</h2>
      <p class="text-gray-600 mb-6">
        Join thousands of users who are already managing their links with urloft.site
      </p>
      <a
        href="/auth/register"
        class="inline-block px-8 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-lg"
      >
        Create Your Account
      </a>
    </div>
  </div>
</div>
