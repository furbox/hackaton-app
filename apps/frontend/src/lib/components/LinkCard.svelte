<script lang="ts">
  import { auth, isAuthenticated } from '../stores/auth';
  import { toast } from '../stores/toast';
  import { api } from '../api';

  export interface Link {
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

  export let link: Link;
  export let onEdit?: (link: Link) => void;
  export let onDelete?: (linkId: number) => void;
  export let onLike?: (linkId: number, liked: boolean) => void;
  export let onFavorite?: (linkId: number, favorited: boolean) => void;

  let liking = false;
  let favoriting = false;

  async function copyShortUrl() {
    try {
      await navigator.clipboard.writeText(link.short_url);
      toast.add('Copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.add('Failed to copy', 'error');
    }
  }

  function truncateUrl(url: string, maxLength = 40): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }

  async function toggleLike() {
    if (!$isAuthenticated) {
      toast.add('Please log in to like links', 'info');
      return;
    }

    if (liking) return;

    liking = true;
    try {
      if (link.liked) {
        await api.delete(`/api/links/${link.id}/like`);
        link.liked = false;
        link.likes_count -= 1;
        toast.add('Removed like', 'info');
      } else {
        await api.post(`/api/links/${link.id}/like`, {});
        link.liked = true;
        link.likes_count += 1;
        toast.add('Link liked!', 'success');
      }
      onLike?.(link.id, link.liked);
    } catch (error: any) {
      toast.add(error.message || 'Failed to update like', 'error');
    } finally {
      liking = false;
    }
  }

  async function toggleFavorite() {
    if (!$isAuthenticated) {
      toast.add('Please log in to favorite links', 'info');
      return;
    }

    if (favoriting) return;

    favoriting = true;
    try {
      if (link.favorited) {
        await api.delete(`/api/links/${link.id}/favorite`);
        link.favorited = false;
        link.saves_count -= 1;
        toast.add('Removed from favorites', 'info');
      } else {
        await api.post(`/api/links/${link.id}/favorite`, {});
        link.favorited = true;
        link.saves_count += 1;
        toast.add('Added to favorites!', 'success');
      }
      onFavorite?.(link.id, link.favorited);
    } catch (error: any) {
      toast.add(error.message || 'Failed to update favorite', 'error');
    } finally {
      favoriting = false;
    }
  }
</script>

<div class="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
  <div class="flex justify-between items-start mb-4">
    <div class="flex-1">
      <h3 class="text-lg font-semibold text-gray-900 mb-1">{link.name}</h3>
      <a
        href={link.short_url}
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-blue-600 hover:text-blue-800 font-mono"
      >
        {link.short_url}
      </a>
    </div>
    <span class="px-2 py-1 text-xs font-semibold rounded-full {link.is_public
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-800'}">
      {link.is_public ? 'Public' : 'Private'}
    </span>
  </div>

  <div class="mb-4">
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      class="text-sm text-gray-600 hover:text-gray-900"
      title={link.url}
    >
      {truncateUrl(link.url)}
    </a>
  </div>

  {#if link.categories && link.categories.length > 0}
    <div class="flex flex-wrap gap-1 mb-4">
      {#each link.categories as category}
        <span class="inline-flex px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
          {category.name}
        </span>
      {/each}
    </div>
  {/if}

  <div class="flex items-center gap-6 text-sm text-gray-600 mb-4">
    <div class="flex items-center gap-1">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      <span>{link.views_count}</span>
    </div>
    <button
      on:click={toggleLike}
      disabled={liking}
      class="flex items-center gap-1 disabled:opacity-50 hover:text-red-600 transition-colors"
      class:text-red-600={link.liked}
    >
      <svg
        class="w-4 h-4"
        fill={link.liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      <span>{link.likes_count}</span>
    </button>
    <button
      on:click={toggleFavorite}
      disabled={favoriting}
      class="flex items-center gap-1 disabled:opacity-50 hover:text-blue-600 transition-colors"
      class:text-blue-600={link.favorited}
    >
      <svg
        class="w-4 h-4"
        fill={link.favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
      <span>{link.saves_count}</span>
    </button>
  </div>

  <div class="flex items-center gap-2">
    <button
      on:click={copyShortUrl}
      class="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
    >
      Copy Link
    </button>
    {#if onEdit}
      <button
        on:click={() => onEdit(link)}
        class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
      >
        Edit
      </button>
    {/if}
    {#if onDelete}
      <button
        on:click={() => onDelete(link.id)}
        class="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
      >
        Delete
      </button>
    {/if}
  </div>
</div>
