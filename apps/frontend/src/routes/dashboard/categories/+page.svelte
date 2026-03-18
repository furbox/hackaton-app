<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { toastStore } from '$lib/stores/toast';

  interface Category {
    id: number;
    name: string;
    description?: string;
    links_count?: number;
    created_at: string;
    updated_at: string;
  }

  let categories: Category[] = [];
  let loading = true;
  let showForm = false;
  let editingCategory: Category | null = null;

  let formData = {
    name: '',
    description: '',
  };

  async function loadCategories() {
    loading = true;
    try {
      const response = await api.get<Category[]>('/api/categories');
      categories = response.data || response;
    } catch (err: any) {
      toastStore.addToast(err.message || 'Failed to load categories', 'error');
    } finally {
      loading = false;
    }
  }

  function openCreateForm() {
    editingCategory = null;
    formData = { name: '', description: '' };
    showForm = true;
  }

  function openEditForm(category: Category) {
    editingCategory = category;
    formData = {
      name: category.name,
      description: category.description || '',
    };
    showForm = true;
  }

  function closeForm() {
    showForm = false;
    editingCategory = null;
    formData = { name: '', description: '' };
  }

  async function handleSubmit() {
    try {
      if (editingCategory) {
        await api.patch(`/api/categories/${editingCategory.id}`, formData);
        toastStore.addToast('Category updated successfully', 'success');
      } else {
        await api.post('/api/categories', formData);
        toastStore.addToast('Category created successfully', 'success');
      }

      closeForm();
      loadCategories();
    } catch (err: any) {
      toastStore.addToast(err.message || 'Failed to save category', 'error');
    }
  }

  async function handleDelete(category: Category) {
    const hasLinks = category.links_count && category.links_count > 0;

    if (!confirm(
      hasLinks
        ? `This category has ${category.links_count} link(s). Delete anyway?`
        : 'Are you sure you want to delete this category?'
    )) {
      return;
    }

    try {
      if (hasLinks) {
        await api.delete(`/api/categories/${category.id}?force=true`);
      } else {
        await api.delete(`/api/categories/${category.id}`);
      }

      toastStore.addToast('Category deleted successfully', 'success');
      loadCategories();
    } catch (err: any) {
      toastStore.addToast(err.message || 'Failed to delete category', 'error');
    }
  }

  onMount(() => {
    loadCategories();
  });
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Categories</h1>
      <p class="mt-1 text-sm text-gray-600">Organize your links with categories</p>
    </div>
    <button
      on:click={openCreateForm}
      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
    >
      Create Category
    </button>
  </div>

  {#if showForm}
    <div class="bg-white shadow rounded-lg p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">
        {editingCategory ? 'Edit Category' : 'Create Category'}
      </h2>
      <form on:submit|preventDefault={handleSubmit}>
        <div class="mb-4">
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            id="name"
            bind:value={formData.name}
            required
            minlength="1"
            maxlength="50"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="mb-4">
          <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea
            id="description"
            bind:value={formData.description}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div class="flex gap-3">
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            {editingCategory ? 'Update' : 'Create'}
          </button>
          <button
            type="button"
            on:click={closeForm}
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if loading}
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">Loading categories...</p>
    </div>
  {:else if categories.length === 0}
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
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No categories yet</h3>
      <p class="mt-1 text-sm text-gray-500">Create categories to organize your links.</p>
      <div class="mt-6">
        <button
          on:click={openCreateForm}
          class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Create Category
        </button>
      </div>
    </div>
  {:else}
    <div class="bg-white shadow rounded-lg overflow-hidden">
      <ul class="divide-y divide-gray-200">
        {#each categories as category}
          <li class="p-6 hover:bg-gray-50">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="text-lg font-medium text-gray-900">{category.name}</h3>
                {#if category.description}
                  <p class="mt-1 text-sm text-gray-600">{category.description}</p>
                {/if}
                <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <span>
                    {category.links_count || 0} link{category.links_count === 1 ? '' : 's'}
                  </span>
                  <span>Created {new Date(category.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div class="flex gap-2 ml-4">
                <button
                  on:click={() => openEditForm(category)}
                  class="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Edit
                </button>
                <button
                  on:click={() => handleDelete(category)}
                  class="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="mt-6">
    <a href="/dashboard" class="text-blue-600 hover:text-blue-800 font-medium">
      ← Back to Dashboard
    </a>
  </div>
</div>
