<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import { toastStore } from '$lib/stores/toast';
  import { toast } from '$lib/stores/toast';

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
    updated_at: string;
    categories?: Array<{ id: number; name: string }>;
  }

  interface Category {
    id: number;
    name: string;
    description?: string;
  }

  let link: Link | null = null;
  let categories: Category[] = [];
  let loading = true;
  let editing = false;
  let showCategoryDropdown = false;

  let formData = {
    name: '',
    url: '',
    is_public: true,
  };

  let selectedCategoryId = '';

  async function loadLink() {
    loading = true;
    try {
      const id = $page.params.id;
      const response = await api.get<{ data: Link }>(`/api/links/${id}`);
      link = response.data;
      formData = {
        name: link.name,
        url: link.url,
        is_public: link.is_public === 1,
      };
    } catch (err: any) {
      toastStore.addToast(err.message || 'Failed to load link', 'error');
    } finally {
      loading = false;
    }
  }

  async function loadCategories() {
    try {
      const response = await api.get<Category[]>('/api/categories');
      categories = response.data || response;
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    }
  }

  async function handleSave() {
    if (!link) return;

    try {
      const updated = await api.patch(`/api/links/${link.id}`, formData);
      link = { ...link, ...updated.data };
      editing = false;
      toastStore.addToast('Link updated successfully', 'success');
    } catch (err: any) {
      toastStore.addToast(err.message || 'Failed to update link', 'error');
    }
  }

  async function handleDelete() {
    if (!link) return;

    if (!confirm('Are you sure you want to delete this link? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/api/links/${link.id}`);
      toastStore.addToast('Link deleted successfully', 'success');
      window.location.href = '/dashboard';
    } catch (err: any) {
      toastStore.addToast(err.message || 'Failed to delete link', 'error');
    }
  }

  function copyShortUrl() {
    if (!link) return;

    navigator.clipboard.writeText(link.short_url);
    toastStore.addToast('Short URL copied to clipboard', 'success');
  }

  async function assignCategory() {
    if (!link || !selectedCategoryId) return;

    try {
      await api.post(`/api/links/${link.id}/categories/${selectedCategoryId}`, {});
      toastStore.addToast('Category assigned successfully', 'success');
      await loadLink();
      showCategoryDropdown = false;
      selectedCategoryId = '';
    } catch (err: any) {
      toastStore.addToast(err.message || 'Failed to assign category', 'error');
    }
  }

  async function removeCategory(categoryId: number) {
    if (!link) return;

    try {
      await api.delete(`/api/links/${link.id}/categories/${categoryId}`);
      toastStore.addToast('Category removed successfully', 'success');
      await loadLink();
    } catch (err: any) {
      toastStore.addToast(err.message || 'Failed to remove category', 'error');
    }
  }

  onMount(() => {
    loadLink();
    loadCategories();
  });
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {#if loading}
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">Loading link...</p>
    </div>
  {:else if link}
    <div class="mb-6">
      <a href="/dashboard" class="text-blue-600 hover:text-blue-800 font-medium">
        ← Back to Dashboard
      </a>
    </div>

    <div class="bg-white shadow rounded-lg p-6 mb-6">
      <div class="flex justify-between items-start mb-4">
        <h1 class="text-3xl font-bold text-gray-900">
          {editing ? (
            <input
              type="text"
              bind:value={formData.name}
              class="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            link.name
          )}
        </h1>
        <div class="flex gap-2">
          {#if editing}
            <button
              on:click={handleSave}
              class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
            >
              Save
            </button>
            <button
              on:click={() => (editing = false)}
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          {:else}
            <button
              on:click={() => (editing = true)}
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Edit
            </button>
            <button
              on:click={handleDelete}
              class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
            >
              Delete
            </button>
          {/if}
        </div>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Short URL</label>
          <div class="flex items-center gap-2">
            <input
              type="text"
              value={link.short_url}
              readonly
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
            <button
              on:click={copyShortUrl}
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Original URL</label>
          {editing ? (
            <input
              type="url"
              bind:value={formData.url}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 hover:text-blue-800 break-all"
            >
              {link.url}
            </a>
          )}
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
          {editing ? (
            <select
              bind:value={formData.is_public}
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={true}>Public</option>
              <option value={false}>Private</option>
            </select>
          ) : (
            <span
              class="inline-flex px-2 py-1 text-xs font-medium rounded-full {link.is_public
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'}"
            >
              {link.is_public ? 'Public' : 'Private'}
            </span>
          )}
        </div>

        <div class="grid grid-cols-3 gap-4 pt-4 border-t">
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-900">{link.views_count}</div>
            <div class="text-sm text-gray-600">Views</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-900">{link.likes_count}</div>
            <div class="text-sm text-gray-600">Likes</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-900">{link.saves_count}</div>
            <div class="text-sm text-gray-600">Saves</div>
          </div>
        </div>

        <div class="pt-4 border-t">
          <div class="text-sm text-gray-600">
            Created {new Date(link.created_at).toLocaleString()}
            {#if link.updated_at !== link.created_at}
              <br />
              Updated {new Date(link.updated_at).toLocaleString()}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white shadow rounded-lg p-6">
      <h2 class="text-xl font-semibold mb-4">Categories</h2>

      {#if link.categories && link.categories.length > 0}
        <div class="flex flex-wrap gap-2 mb-4">
          {#each link.categories as category}
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {category.name}
              <button
                on:click={() => removeCategory(category.id)}
                class="hover:text-blue-600 focus:outline-none"
              >
                ×
              </button>
            </span>
          {/each}
        </div>
      {:else}
        <p class="text-gray-600 mb-4">No categories assigned yet.</p>
      {/if}

      {#if showCategoryDropdown}
        <div class="flex gap-2">
          <select
            bind:value={selectedCategoryId}
            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a category</option>
            {#each categories as category}
              {#if !link.categories || !link.categories.find((c) => c.id === category.id)}
                <option value={category.id}>{category.name}</option>
              {/if}
            {/each}
          </select>
          <button
            on:click={assignCategory}
            disabled={!selectedCategoryId}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
          <button
            on:click={() => {
              showCategoryDropdown = false;
              selectedCategoryId = '';
            }}
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      {:else}
        <button
          on:click={() => (showCategoryDropdown = true)}
          class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
        >
          + Add Category
        </button>
      {/if}
    </div>
  {/if}
</div>
