<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type User } from '$lib/api';
  import { toastStore } from '$lib/stores/toast';
  import BadgeDisplay from '$lib/components/BadgeDisplay.svelte';

  let user: User | null = null;
  let loading = true;
  let saving = false;
  let error = '';
  let username = '';
  let bio = '';
  let avatar_url = '';

  async function loadProfile() {
    loading = true;
    error = '';
    try {
      const response = await api.get<{ data: User }>('/api/users/me');
      user = response.data;
      username = user.username;
      bio = user.bio || '';
      avatar_url = user.avatar_url || '';
    } catch (err: any) {
      error = err.message || 'Failed to load profile';
    } finally {
      loading = false;
    }
  }

  async function handleSave() {
    saving = true;
    error = '';
    try {
      const response = await api.patch<{ data: User }>('/api/users/me', {
        username: username.trim(),
        bio: bio.trim() || null,
        avatar_url: avatar_url.trim() || null,
      });
      user = response.data;
      toastStore.show('Profile updated successfully', 'success');
    } catch (err: any) {
      if (err.message === 'username_taken') {
        error = 'Username is already taken';
      } else if (err.message === 'bio_too_long') {
        error = 'Bio must be 280 characters or less';
      } else {
        error = err.message || 'Failed to update profile';
      }
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    loadProfile();
  });
</script>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-gray-900">Edit Profile</h1>
    <p class="mt-1 text-sm text-gray-600">Manage your public profile information</p>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">Loading profile...</p>
    </div>
  {:else if error && !user}
    <div class="bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-red-800">{error}</p>
    </div>
  {:else if user}
    <div class="space-y-6">
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex items-center gap-4 mb-6">
          {#if avatar_url}
            <img src={avatar_url} alt={username} class="w-20 h-20 rounded-full object-cover" />
          {:else}
            <div class="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
              <span class="text-2xl font-bold text-gray-500">{username.charAt(0).toUpperCase()}</span>
            </div>
          {/if}
          <div>
            <h2 class="text-xl font-semibold text-gray-900">{user.username}</h2>
            <p class="text-sm text-gray-600">{user.email}</p>
            <div class="mt-2">
              <BadgeDisplay rank={user.rank} badges={[]} />
            </div>
          </div>
        </div>

        <form on:submit|preventDefault={handleSave} class="space-y-4">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              bind:value={username}
              minlength="3"
              maxlength="30"
              pattern="[a-zA-Z0-9_]+"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter username (alphanumeric and underscore only)"
            />
            <p class="mt-1 text-xs text-gray-500">
              3-30 characters, alphanumeric and underscore only
            </p>
          </div>

          <div>
            <label for="avatar_url" class="block text-sm font-medium text-gray-700 mb-1">
              Avatar URL
            </label>
            <input
              type="url"
              id="avatar_url"
              bind:value={avatar_url}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/avatar.jpg"
            />
            <p class="mt-1 text-xs text-gray-500">URL to your profile picture</p>
          </div>

          <div>
            <label for="bio" class="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              id="bio"
              bind:value={bio}
              maxlength="280"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tell us about yourself..."
            ></textarea>
            <p class="mt-1 text-xs text-gray-500">{bio.length}/280 characters</p>
          </div>

          {#if error}
            <div class="bg-red-50 border border-red-200 rounded-md p-3">
              <p class="text-sm text-red-800">{error}</p>
            </div>
          {/if}

          <div class="flex justify-end gap-3">
            <a
              href="/dashboard"
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={saving}
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>
