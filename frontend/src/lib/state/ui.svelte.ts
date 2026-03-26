/**
 * Estado global mínimo de la UI usando Svelte 5 Runes.
 */

class UIState {
    mobileMenuOpen = $state(false);
    toasts = $state<{ id: string; message: string; type: 'info' | 'success' | 'error' }[]>([]);

    toggleMobileMenu() {
        this.mobileMenuOpen = !this.mobileMenuOpen;
    }

    addToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
        const id = crypto.randomUUID();
        this.toasts.push({ id, message, type });
        setTimeout(() => this.removeToast(id), 5000);
    }

    removeToast(id: string) {
        this.toasts = this.toasts.filter(t => t.id !== id);
    }
}

export const ui = new UIState();
