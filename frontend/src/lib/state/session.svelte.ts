/**
 * Estado global de la sesión del usuario usando Svelte 5 Runes.
 *
 * SSR Safety: This singleton is ONLY imported in .svelte files (client-side).
 * It is NOT imported in any hooks.server.ts, +layout.server.ts, or +page.server.ts.
 * The dashboard layout has `ssr = false`, so SessionState is never instantiated
 * or mutated during SSR. No browser guard is needed here.
 *
 * If this file is ever imported in a server-side context in the future, the
 * setAuthenticated/setGuest calls MUST be wrapped with a `browser` guard from
 * `$app/environment` to prevent cross-request reactive graph growth.
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
