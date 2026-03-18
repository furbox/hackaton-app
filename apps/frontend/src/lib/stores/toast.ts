import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  return {
    subscribe,
    add: (message: string, type: ToastType = 'info') => {
      const id = Date.now().toString() + Math.random().toString(36).substring(2);
      const toast: Toast = { id, message, type };

      update((toasts) => [...toasts, toast]);

      setTimeout(() => {
        update((toasts) => toasts.filter((t) => t.id !== id));
      }, 3000);
    },
    remove: (id: string) => {
      update((toasts) => toasts.filter((t) => t.id !== id));
    },
  };
}

export const toast = createToastStore();
