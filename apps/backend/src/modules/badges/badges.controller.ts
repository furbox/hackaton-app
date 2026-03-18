import type { Elysia } from 'elysia';
import { getUserRankInfo, getPublicUserRankInfo } from './badges.service';

export function badgesController(app: Elysia) {
  return app
    .get('/badges/me', ({ user, db }) => {
      const rankInfo = getUserRankInfo(db, user.userId);
      return {
        data: rankInfo,
      };
    })
    .get('/badges/:username', ({ params, db }) => {
      const rankInfo = getPublicUserRankInfo(db, params.username);

      if (!rankInfo) {
        throw new Error('User not found');
      }

      return {
        data: rankInfo,
      };
    });
}
