/**
 * Estado global de la sesión del usuario usando Svelte 5 Runes.
 */

interface User {
    id: number;
    username: string;
    email: string;
    avatar_url?: string;
    rank: string;
}

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'guest';

class SessionState {
    user = $state<User | null>(null);
    status = $state<AuthStatus>('idle');

    isAuthenticated = $derived(this.status === 'authenticated');
    isAdmin = $derived(false); // TODO: Implementar lógica de roles si aplica
    displayName = $derived(this.user?.username ?? 'Guest');

    setAuthenticated(user: User) {
        this.user = user;
        this.status = 'authenticated';
    }

    setGuest() {
        this.user = null;
        this.status = 'guest';
    }

    setLoading() {
        this.status = 'loading';
    }
}

export const session = new SessionState();
