import type { Elysia } from 'elysia';
import { getOwnProfile, updateProfile, getPublicProfile, getPublicProfileLinks } from './users.service';

export function usersController(app: Elysia) {
  return app
    .get('/users/me', ({ db, user }) => {
      const profile = getOwnProfile(db, user.id);
      return {
        data: profile,
      };
    })
    .patch('/users/me', ({ db, user, body }) => {
      try {
        const updated = updateProfile(db, user.id, body);
        return {
          data: updated,
        };
      } catch (error: any) {
        if (error.message === 'Username already taken') {
          throw new Error('username_taken');
        }
        if (error.message === 'Bio must be 280 characters or less') {
          throw new Error('bio_too_long');
        }
        throw error;
      }
    })
    .get('/users/:username', ({ params, db, query }) => {
      const profile = getPublicProfile(db, params.username);

      if (!profile) {
        throw new Error('User not found');
      }

      const page = parseInt((query.page as string) || '1');
      const limit = parseInt((query.limit as string) || '20');

      const links = getPublicProfileLinks(db, params.username, page, limit);

      return {
        data: {
          profile,
          links: links.links,
          meta: links.meta,
        },
      };
    });
}
