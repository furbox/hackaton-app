<script lang="ts">
  import { api } from '$lib/api';

  let name = '';
  let url = '';
  let is_public = true;
  let loading = false;
  let error = '';
  let successMessage = '';

  async function handleSubmit() {
    error = '';
    successMessage = '';
    loading = true;

    try {
      const response = await api.post<{ data: any }>('/api/links', {
        name,
        url,
        is_public,
      });

      successMessage = `Link created! ${response.data.short_url}`;

      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err: any) {
      error = err.message || 'Failed to create link';
    } finally {
      loading = false;
    }
  }

  function isValidUrl() {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
</script>

<div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-gray-900">Create New Link</h1>
    <p class="mt-1 text-sm text-gray-600">Shorten any URL with a custom name</p>
  </div>

  <div class="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
    <form on:submit|preventDefault={handleSubmit}>
      <div class="space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700">
            Link Name
          </label>
          <input
            type="text"
            id="name"
            bind:value={name}
            required
            minlength="1"
            maxlength="100"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="My awesome link"
          />
          <p class="mt-1 text-xs text-gray-500">
            {name.length}/100 characters
          </p>
        </div>

        <div>
          <label for="url" class="block text-sm font-medium text-gray-700">
            URL to Shorten
          </label>
          <input
            type="url"
            id="url"
            bind:value={url}
            required
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="https://example.com/very-long-url"
          />
          {#if url && !isValidUrl()}
            <p class="mt-1 text-xs text-red-600">Please enter a valid URL (starting with http:// or https://)</p>
          {/if}
        </div>

        <div class="flex items-center">
          <input
            type="checkbox"
            id="is_public"
            bind:checked={is_public}
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="is_public" class="ml-2 block text-sm text-gray-900">
            Make this link public
          </label>
        </div>

        {#if error}
          <div class="bg-red-50 border border-red-200 rounded-md p-3">
            <p class="text-sm text-red-800">{error}</p>
          </div>
        {/if}

        {#if successMessage}
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <p class="text-sm text-green-800">{successMessage}</p>
          </div>
        {/if}

        <div class="flex gap-3">
          <button
            type="submit"
            disabled={loading || !name || !url || !isValidUrl()}
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Link'}
          </button>
          <a
            href="/dashboard"
            class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </a>
        </div>
      </div>
    </form>
  </div>
</div>
