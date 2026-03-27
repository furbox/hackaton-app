// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      session: {
        user: {
          id: number;
          username: string;
          email: string;
          avatarUrl: string | null;
          rank: string;
        } | null;
        token: string | null;
      } | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  // Type augmentation for fetch duplex option
  // See: https://fetch.spec.whatwg.org/#requestinit
  interface RequestInit {
    duplex?: 'half';
  }
}

export {};
