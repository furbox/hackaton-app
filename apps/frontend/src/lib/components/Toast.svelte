<script lang="ts">
  import { toast, type Toast } from '../stores/toast';
  import { fade } from 'svelte/transition';

  function getIcon(type: Toast['type']) {
    switch (type) {
      case 'success':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
      case 'error':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
      case 'info':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }
  }

  function getClasses(type: Toast['type']) {
    switch (type) {
      case 'success':
        return 'bg-green-500 border-green-600 text-white';
      case 'error':
        return 'bg-red-500 border-red-600 text-white';
      case 'info':
        return 'bg-blue-500 border-blue-600 text-white';
    }
  }
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
  {#each $toast as t (t.id)}
    <div
      class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border {getClasses(t.type)}"
      transition:fade={{ duration: 200 }}
    >
      {@html getIcon(t.type)}
      <span class="text-sm font-medium">{t.message}</span>
      <button
        on:click={() => toast.remove(t.id)}
        class="ml-2 hover:opacity-70"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  {/each}
</div>
