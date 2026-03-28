/**
 * Estado global mínimo de la UI usando Svelte 5 Runes.
 */
import { browser } from '$app/environment';

class UIState {
    mobileMenuOpen = $state(false);
    toasts = $state<{ id: string; message: string; type: 'info' | 'success' | 'error' }[]>([]);

    toggleMobileMenu() {
        this.mobileMenuOpen = !this.mobileMenuOpen;
    }

    addToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
        const id = crypto.randomUUID();
        this.toasts.push({ id, message, type });
        // Guard: setTimeout schedules a libuv timer. On SSR this leaks because
        // the Node.js process keeps the timer alive beyond the request lifetime.
        // Only schedule auto-remove on the client.
        if (browser) {
            setTimeout(() => this.removeToast(id), 5000);
        }
    }

    removeToast(id: string) {
        this.toasts = this.toasts.filter(t => t.id !== id);
    }
}

export const ui = new UIState();
