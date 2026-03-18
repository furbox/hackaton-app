import Database from 'bun:sqlite';

export type Period = 'day' | 'week' | 'month' | 'year' | 'all';
export type Metric = 'views' | 'likes' | 'saves';

export interface TopLink {
  id: number;
  name: string;
  short_code: string;
  short_url: string;
  username: string;
  count: number;
  created_at: string;
}

export interface StatsData {
  period: Period;
  metric: Metric;
  top_links: TopLink[];
}

function getDateFilter(period: Period): string {
  switch (period) {
    case 'day':
      return "datetime('now', '-1 day')";
    case 'week':
      return "datetime('now', '-7 days')";
    case 'month':
      return "datetime('now', '-1 month')";
    case 'year':
      return "datetime('now', '-1 year')";
    case 'all':
      return "datetime('now', '-100 years')";
    default:
      throw new Error('Invalid period');
  }
}

export function getTopLinksByPeriod(
  db: Database,
  period: Period,
  metric: Metric,
  limit = 10
): TopLink[] {
  const dateFilter = getDateFilter(period);
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  if (metric === 'views') {
    const links = db.query(`
      SELECT 
        l.id,
        l.name,
        l.short_code,
        u.username,
        COUNT(*) as count,
        MAX(l.created_at) as created_at
      FROM link_logs ll
      JOIN links l ON ll.link_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE ll.action = 'view'
        AND l.is_public = 1
        AND ll.created_at >= ${dateFilter}
      GROUP BY ll.link_id
      ORDER BY count DESC
      LIMIT ?
    `).all(limit) as any[];

    return links.map((link) => ({
      id: link.id,
      name: link.name,
      short_code: link.short_code,
      short_url: `${appUrl}/r/${link.short_code}`,
      username: link.username,
      count: link.count,
      created_at: link.created_at,
    }));
  }

  if (metric === 'likes') {
    const links = db.query(`
      SELECT 
        l.id,
        l.name,
        l.short_code,
        u.username,
        l.likes_count as count,
        l.created_at
      FROM links l
      JOIN users u ON l.user_id = u.id
      WHERE l.is_public = 1
        AND l.created_at >= ${dateFilter}
      ORDER BY l.likes_count DESC
      LIMIT ?
    `).all(limit) as any[];

    return links.map((link) => ({
      id: link.id,
      name: link.name,
      short_code: link.short_code,
      short_url: `${appUrl}/r/${link.short_code}`,
      username: link.username,
      count: link.count,
      created_at: link.created_at,
    }));
  }

  if (metric === 'saves') {
    const links = db.query(`
      SELECT 
        l.id,
        l.name,
        l.short_code,
        u.username,
        l.saves_count as count,
        l.created_at
      FROM links l
      JOIN users u ON l.user_id = u.id
      WHERE l.is_public = 1
        AND l.created_at >= ${dateFilter}
      ORDER BY l.saves_count DESC
      LIMIT ?
    `).all(limit) as any[];

    return links.map((link) => ({
      id: link.id,
      name: link.name,
      short_code: link.short_code,
      short_url: `${appUrl}/r/${link.short_code}`,
      username: link.username,
      count: link.count,
      created_at: link.created_at,
    }));
  }

  throw new Error('Invalid metric');
}

export function getAllStats(db: Database, period: Period = 'all'): StatsData {
  return {
    period,
    metric: 'views',
    top_links: getTopLinksByPeriod(db, period, 'views'),
  };
}

export function getStatsByMetric(db: Database, period: Period, metric: Metric): StatsData {
  return {
    period,
    metric,
    top_links: getTopLinksByPeriod(db, period, metric),
  };
}

export interface LinkAnalytics {
  link_id: number;
  period: Period;
  views: number;
  likes: number;
  saves: number;
}

export function getLinkAnalytics(db: Database, linkId: number, period: Period): LinkAnalytics {
  const dateFilter = getDateFilter(period);

  const viewsResult = db.query(`
    SELECT COUNT(*) as count
    FROM link_logs
    WHERE link_id = ? AND action = 'view' AND created_at >= ${dateFilter}
  `).get(linkId) as { count: number } | undefined;

  const linkResult = db.query(`
    SELECT likes_count, saves_count
    FROM links
    WHERE id = ?
  `).get(linkId) as { likes_count: number; saves_count: number } | undefined;

  if (!linkResult) {
    throw new Error('Link not found');
  }

  return {
    link_id: linkId,
    period,
    views: viewsResult?.count || 0,
    likes: linkResult.likes_count,
    saves: linkResult.saves_count,
  };
}
