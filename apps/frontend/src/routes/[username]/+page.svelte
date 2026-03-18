<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api, type BadgeType } from '$lib/api';
  import BadgeDisplay from '$lib/components/BadgeDisplay.svelte';

  interface PublicProfile {
    id: number;
    username: string;
    avatar_url: string | null;
    bio: string | null;
    rank: BadgeType;
    public_link_count: number;
    created_at: string;
  }

  interface Link {
    id: number;
    name: string;
    short_code: string;
    url: string;
    views_count: number;
    likes_count: number;
    saves_count: number;
    created_at: string;
  }

  let profile: PublicProfile | null = null;
  let links: Link[] = [];
  let loading = true;
  let error = '';
  let currentPage = 1;
  let limit = 20;
  let total = 0;

  async function loadProfile() {
    loading = true;
    error = '';
    try {
      const username = $page.params.username;
      const response = await api.get<{
        data: {
          profile: PublicProfile;
          links: Link[];
          meta: { page: number; limit: number; total: number };
        };
      }>(`/api/users/${username}?page=${currentPage}&limit=${limit}`);

      profile = response.data.profile;
      links = response.data.links;
      total = response.data.meta.total;
    } catch (err: any) {
      error = err.message || 'Failed to load profile';
    } finally {
      loading = false;
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  }

  function nextPage() {
    if (currentPage * limit < total) {
      currentPage++;
      loadProfile();
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
      loadProfile();
    }
  }

  onMount(() => {
    loadProfile();
  });

  $: currentPage = 1;
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {#if loading}
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">Loading profile...</p>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-red-800">{error}</p>
    </div>
  {:else if profile}
    <div class="space-y-6">
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex items-start gap-6">
          {#if profile.avatar_url}
            <img
              src={profile.avatar_url}
              alt={profile.username}
              class="w-24 h-24 rounded-full object-cover"
            />
          {:else}
            <div
              class="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
            >
              <span class="text-3xl font-bold text-white">{profile.username.charAt(0).toUpperCase()}</span>
            </div>
          {/if}

          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h1 class="text-2xl font-bold text-gray-900">@{profile.username}</h1>
              <BadgeDisplay rank={profile.rank} badges={[]} size="md" />
            </div>

            {#if profile.bio}
              <p class="text-gray-600 mb-3">{profile.bio}</p>
            {/if}

            <div class="flex flex-wrap gap-4 text-sm text-gray-500">
              <div class="flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
                  />
                </svg>
                <span>{profile.public_link_count} public links</span>
              </div>
              <div class="flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>Joined {formatDate(profile.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Public Links</h2>

        {#if links.length === 0}
          <div class="text-center py-12 bg-gray-50 rounded-lg">
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
            <h3 class="mt-2 text-sm font-medium text-gray-900">No public links</h3>
            <p class="mt-1 text-sm text-gray-500">This user hasn't shared any links yet.</p>
          </div>
        {:else}
          <div class="bg-white shadow rounded-lg overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Link Name
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Stats
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Created
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Short URL
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each links as link}
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900">{link.name}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex gap-4 text-sm text-gray-500">
                          <span class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                            {link.views_count}
                          </span>
                          <span class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path
                                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                              />
                            </svg>
                            {link.likes_count}
                          </span>
                          <span class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                              />
                            </svg>
                            {link.saves_count}
                          </span>
                        </div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-500">{formatDate(link.created_at)}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <a
                          href="/r/{link.short_code}"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-sm text-blue-600 hover:text-blue-800 font-mono"
                        >
                          /{link.short_code}
                        </a>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

          {#if total > limit}
            <div class="mt-6 flex justify-center">
              <div class="flex gap-2">
                <button
                  on:click={prevPage}
                  disabled={currentPage === 1}
                  class="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span
                  class="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700"
                >
                  Page {currentPage} of {Math.ceil(total / limit)}
                </span>
                <button
                  on:click={nextPage}
                  disabled={currentPage * limit >= total}
                  class="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>
