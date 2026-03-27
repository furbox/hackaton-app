import { writable, type Writable } from 'svelte/store';

/**
 * Session user interface
 */
export interface SessionUser {
	id: number;
	username: string;
	email: string;
	avatarUrl: string | null;
	rank: string;
}

/**
 * Session interface
 */
export interface Session {
	user: SessionUser | null;
	token: string | null;
	isLoading: boolean;
}

/**
 * Initial session state
 */
const initialState: Session = {
	user: null,
	token: null,
	isLoading: true
};

/**
 * Create session store with methods for hydration, updates, and clearing
 */
function createSessionStore(): Writable<Session> & {
	hydrate: (serverSession: Session | null) => void;
	clear: () => void;
	updateUser: (user: SessionUser | null) => void;
} {
	const { subscribe, set, update } = writable<Session>(initialState);

	return {
		subscribe,
		set,
		update,

		/**
		 * Hydrate store from server session data
		 */
		hydrate: (serverSession: Session | null) => {
			if (serverSession) {
				set({
					...serverSession,
					isLoading: false
				});
			} else {
				set({
					user: null,
					token: null,
					isLoading: false
				});
			}
		},

		/**
		 * Clear session (e.g., after logout)
		 */
		clear: () => {
			set({
				user: null,
				token: null,
				isLoading: false
			});
		},

		/**
		 * Update user data while preserving token
		 */
		updateUser: (user: SessionUser | null) => {
			update((current) => ({
				...current,
				user,
				isLoading: false
			}));
		}
	};
}

/**
 * Global session store
 */
export const session = createSessionStore();
