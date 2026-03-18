import type { Elysia } from 'elysia';
import { getStatsByMetric, getAllStats, getLinkAnalytics } from './stats.service';

export function statsController(app: Elysia) {
  return app
    .get('/stats/top', ({ query, db }) => {
      const period = (query.period as 'day' | 'week' | 'month' | 'year' | 'all') || 'all';
      const metric = (query.metric as 'views' | 'likes' | 'saves') || 'views';

      const validPeriods = ['day', 'week', 'month', 'year', 'all'];
      const validMetrics = ['views', 'likes', 'saves'];

      if (!validPeriods.includes(period)) {
        throw new Error('Invalid period');
      }

      if (!validMetrics.includes(metric)) {
        throw new Error('Invalid metric');
      }

      const stats = getStatsByMetric(db, period, metric);

      return {
        data: stats,
      };
    })
    .get('/stats', ({ db }) => {
      const stats = getAllStats(db);

      return {
        data: stats,
      };
    })
    .get('/stats/link/:id', ({ params, query, db }) => {
      const period = (query.period as 'day' | 'week' | 'month' | 'year' | 'all') || 'all';

      const validPeriods = ['day', 'week', 'month', 'year', 'all'];

      if (!validPeriods.includes(period)) {
        throw new Error('Invalid period');
      }

      const analytics = getLinkAnalytics(db, parseInt(params.id), period);

      return {
        data: analytics,
      };
    });
}
