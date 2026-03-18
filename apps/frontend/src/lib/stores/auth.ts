import { writable, derived } from 'svelte/store';
import type { User } from './api';

interface AuthState {
  token: string | null;
  user: User | null;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    token: localStorage.getItem('auth_token'),
    user: JSON.parse(localStorage.getItem('auth_user') || 'null'),
  });

  return {
    subscribe,
    login: (token: string, user: User) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      set({ token, user });
    },
    logout: () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      set({ token: null, user: null });
    },
    setUser: (user: User) => {
      localStorage.setItem('auth_user', JSON.stringify(user));
      update((state) => ({ ...state, user }));
    },
  };
}

export const auth = createAuthStore();
export const isAuthenticated = derived(auth, ($auth) => !!$auth.token);
