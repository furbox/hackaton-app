<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import LinkCard from '$lib/components/LinkCard.svelte';
  import { toastStore } from '$lib/stores/toast';

  interface Link {
    id: number;
    name: string;
    url: string;
    short_code: string;
    short_url: string;
    is_public: number;
    views_count: number;
    likes_count: number;
    saves_count: number;
    created_at: string;
    liked?: boolean;
    favorited?: boolean;
    categories?: Array<{ id: number; name: string }>;
  }

  interface Category {
    id: number;
    name: string;
    description?: string;
    links_count?: number;
  }

  interface PaginatedResponse {
    data: Link[];
    meta: {
      page: number;
      limit: number;
      total: number;
    };
  }

  let links: Link[] = [];
  let categories: Category[] = [];
  let loading = true;
  let error = '';
  let page = 1;
  let limit = 20;
  let total = 0;
  let selectedCategory = '';
  let searchQuery = '';
  let sortBy = 'created_at';
  let sortOrder = 'desc';
  let searchTimeout: NodeJS.Timeout;

  async function loadCategories() {
    try {
      const response = await api.get<Category[]>('/api/categories');
      categories = response.data || response;
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    }
  }

  async function loadLinks() {
    loading = true;
    error = '';
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: sortBy,
        order: sortOrder,
      });

      if (selectedCategory) params.set('category_id', selectedCategory);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const response = await api.get<PaginatedResponse>(`/api/dashboard?${params.toString()}`);
      links = response.data;
      total = response.meta.total;

      for (const link of links) {
        try {
          const social = await api.get<{ data: { liked: boolean; favorited: boolean } }>(
            `/api/links/${link.id}/social`
          );
          link.liked = social.data.liked;
          link.favorited = social.data.favorited;
        } catch (err) {
          console.error(`Failed to load social status for link ${link.id}:`, err);
          link.liked = false;
          link.favorited = false;
        }
      }
    } catch (err: any) {
      error = err.message || 'Failed to load links';
    } finally {
      loading = false;
    }
  }

  async function handleDelete(linkId: number) {
    if (!confirm('Are you sure you want to delete this link?')) return;

    try {
      await api.delete(`/api/links/${linkId}`);
      links = links.filter((l) => l.id !== linkId);
      total--;
    } catch (err: any) {
      alert(err.message || 'Failed to delete link');
    }
  }

  function handleEdit(link: Link) {
    window.location.href = `/dashboard/links/${link.id}`;
  }

  function handleLike(linkId: number, liked: boolean) {
    const link = links.find((l) => l.id === linkId);
    if (link) {
      link.liked = liked;
    }
  }

  function handleFavorite(linkId: number, favorited: boolean) {
    const link = links.find((l) => l.id === linkId);
    if (link) {
      link.favorited = favorited;
    }
  }

  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      page = 1;
      loadLinks();
    }, 300);
  }

  function handleFilterChange() {
    page = 1;
    loadLinks();
  }

  onMount(() => {
    loadCategories();
    loadLinks();
  });

  function nextPage() {
    if (page * limit < total) {
      page++;
      loadLinks();
    }
  }

  function prevPage() {
    if (page > 1) {
      page--;
      loadLinks();
    }
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">My Links</h1>
      <p class="mt-1 text-sm text-gray-600">Manage your short URLs</p>
    </div>
    <div class="flex gap-3">
      <a
        href="/dashboard/categories"
        class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
      >
        Manage Categories
      </a>
      <a
        href="/dashboard/links/new"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
      >
        Create Link
      </a>
    </div>
  </div>

  <div class="bg-white shadow rounded-lg p-4 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label for="search" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <input
          type="text"
          id="search"
          bind:value={searchQuery}
          on:input={handleSearch}
          placeholder="Search links..."
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="category" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          id="category"
          bind:value={selectedCategory}
          on:change={handleFilterChange}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {#each categories as category}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>
      </div>

      <div>
        <label for="sortBy" class="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
        <select
          id="sortBy"
          bind:value={sortBy}
          on:change={handleFilterChange}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="created_at">Date Created</option>
          <option value="views_count">Views</option>
          <option value="likes_count">Likes</option>
          <option value="saves_count">Saves</option>
          <option value="name">Name</option>
        </select>
      </div>

      <div>
        <label for="sortOrder" class="block text-sm font-medium text-gray-700 mb-1">Order</label>
        <select
          id="sortOrder"
          bind:value={sortOrder}
          on:change={handleFilterChange}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">Loading links...</p>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-red-800">{error}</p>
    </div>
  {:else if links.length === 0}
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
      <h3 class="mt-2 text-sm font-medium text-gray-900">No links yet</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by creating your first short link.</p>
      <div class="mt-6">
        <a
          href="/dashboard/links/new"
          class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Create Link
        </a>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each links as link (link.id)}
        <LinkCard link={link} {onEdit} onDelete={handleDelete} onLike={handleLike} onFavorite={handleFavorite} />
      {/each}
    </div>

    {#if total > limit}
      <div class="mt-6 flex justify-center">
        <div class="flex gap-2">
          <button
            on:click={prevPage}
            disabled={page === 1}
            class="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span class="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            on:click={nextPage}
            disabled={page * limit >= total}
            class="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>
