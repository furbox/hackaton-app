import Database from 'bun:sqlite';
import { generateShortCode } from '../../utils/shortCode';
import { logVisit, logLike, removeLike, logFavorite, removeFavorite, getUserLinkAction } from '../logs/logs.service';
import { recalculateRank } from '../badges/badges.service';

export interface CreateLinkInput {
  name: string;
  url: string;
  is_public?: boolean;
}

export interface UpdateLinkInput {
  name?: string;
  url?: string;
  is_public?: boolean;
}

export interface Link {
  id: number;
  user_id: number;
  name: string;
  url: string;
  short_code: string;
  is_public: number;
  likes_count: number;
  saves_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
  short_url?: string;
}

export interface PaginatedLinks {
  data: Link[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export function createLink(db: Database, userId: number, input: CreateLinkInput): Link {
  const { name, url, is_public = true } = input;

  if (name.length < 1 || name.length > 100) {
    throw new Error('Name must be between 1 and 100 characters');
  }

  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  const short_code = generateShortCode(db);
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const result = db.query(`
    INSERT INTO links (user_id, name, url, short_code, is_public)
    VALUES (?, ?, ?, ?, ?)
    RETURNING id, user_id, name, url, short_code, is_public, likes_count, saves_count, views_count, created_at, updated_at
  `).get(userId, name, url, short_code, is_public ? 1 : 0) as Link;

  result.short_url = `${appUrl}/r/${short_code}`;

  recalculateRank(db, userId);

  return result;
}

export function listUserLinks(
  db: Database,
  userId: number,
  { page = 1, limit = 20, category_id, search }: { page?: number; limit?: number; category_id?: number; search?: string }
): PaginatedLinks {
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE l.user_id = ?';
  const params: any[] = [userId];

  if (category_id) {
    whereClause += ' AND lc.category_id = ?';
    params.push(category_id);
  }

  if (search) {
    whereClause += ' AND l.name LIKE ?';
    params.push(`%${search}%`);
  }

  const links = db.query(`
    SELECT 
      l.id, l.user_id, l.name, l.url, l.short_code, l.is_public,
      l.likes_count, l.saves_count, l.views_count, l.created_at, l.updated_at
    FROM links l
    ${category_id ? 'LEFT JOIN link_categories lc ON l.id = lc.link_id' : ''}
    ${whereClause}
    GROUP BY l.id
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Link[];

  const countResult = db.query(`
    SELECT COUNT(DISTINCT l.id) as total
    FROM links l
    ${category_id ? 'LEFT JOIN link_categories lc ON l.id = lc.link_id' : ''}
    ${whereClause}
  `).get(...params) as { total: number };

  return {
    data: links,
    meta: {
      page,
      limit,
      total: countResult.total,
    },
  };
}

export function getLinkById(db: Database, linkId: number, userId: number): Link {
  const link = db.query(`
    SELECT id, user_id, name, url, short_code, is_public,
           likes_count, saves_count, views_count, created_at, updated_at
    FROM links
    WHERE id = ?
  `).get(linkId) as Link | undefined;

  if (!link) {
    throw new Error('Link not found');
  }

  if (link.user_id !== userId) {
    throw new Error('Forbidden');
  }

  return link;
}

export function updateLink(db: Database, linkId: number, userId: number, input: UpdateLinkInput): Link {
  const existing = getLinkById(db, linkId, userId);

  const updates: string[] = [];
  const params: any[] = [];

  if (input.name !== undefined) {
    if (input.name.length < 1 || input.name.length > 100) {
      throw new Error('Name must be between 1 and 100 characters');
    }
    updates.push('name = ?');
    params.push(input.name);
  }

  if (input.url !== undefined) {
    try {
      new URL(input.url);
    } catch {
      throw new Error('Invalid URL format');
    }
    updates.push('url = ?');
    params.push(input.url);
  }

  if (input.is_public !== undefined) {
    updates.push('is_public = ?');
    params.push(input.is_public ? 1 : 0);
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = datetime(\'now\')');
  params.push(linkId, userId);

  const result = db.query(`
    UPDATE links
    SET ${updates.join(', ')}
    WHERE id = ? AND user_id = ?
    RETURNING id, user_id, name, url, short_code, is_public, likes_count, saves_count, views_count, created_at, updated_at
  `).get(...params) as Link;

  return result;
}

export function deleteLink(db: Database, linkId: number, userId: number): void {
  const existing = getLinkById(db, linkId, userId);

  db.query('DELETE FROM links WHERE id = ? AND user_id = ?').run(linkId, userId);

  recalculateRank(db, userId);
}

export interface RedirectResult {
  url: string;
  linkId: number;
}

export function resolveShortCode(db: Database, shortCode: string, visitorIp: string, visitorUserId?: number): RedirectResult {
  const link = db.query(`
    SELECT id, user_id, url, is_public
    FROM links
    WHERE short_code = ?
  `).get(shortCode) as { id: number; user_id: number; url: string; is_public: number } | undefined;

  if (!link) {
    throw new Error('Link not found');
  }

  if (!link.is_public) {
    if (!visitorUserId || visitorUserId !== link.user_id) {
      throw new Error('Forbidden');
    }
  }

  logVisit(db, link.id, visitorIp);

  return {
    url: link.url,
    linkId: link.id,
  };
}

export function likeLink(db: Database, linkId: number, userId: number): { likes_count: number; liked: boolean } {
  const link = db.query('SELECT id, is_public FROM links WHERE id = ?').get(linkId) as { id: number; is_public: number } | undefined;

  if (!link) {
    throw new Error('Link not found');
  }

  if (!link.is_public) {
    throw new Error('Cannot like private links');
  }

  logLike(db, linkId, userId);

  const updated = db.query('SELECT likes_count FROM links WHERE id = ?').get(linkId) as { likes_count: number };

  return {
    likes_count: updated.likes_count,
    liked: true,
  };
}

export function unlikeLink(db: Database, linkId: number, userId: number): { likes_count: number; liked: boolean } {
  removeLike(db, linkId, userId);

  const updated = db.query('SELECT likes_count FROM links WHERE id = ?').get(linkId) as { likes_count: number };

  return {
    likes_count: updated.likes_count,
    liked: false,
  };
}

export function favoriteLink(db: Database, linkId: number, userId: number): { saves_count: number; favorited: boolean } {
  const link = db.query('SELECT id, is_public FROM links WHERE id = ?').get(linkId) as { id: number; is_public: number } | undefined;

  if (!link) {
    throw new Error('Link not found');
  }

  if (!link.is_public) {
    throw new Error('Cannot favorite private links');
  }

  logFavorite(db, linkId, userId);

  const updated = db.query('SELECT saves_count FROM links WHERE id = ?').get(linkId) as { saves_count: number };

  return {
    saves_count: updated.saves_count,
    favorited: true,
  };
}

export function unfavoriteLink(db: Database, linkId: number, userId: number): { saves_count: number; favorited: boolean } {
  removeFavorite(db, linkId, userId);

  const updated = db.query('SELECT saves_count FROM links WHERE id = ?').get(linkId) as { saves_count: number };

  return {
    saves_count: updated.saves_count,
    favorited: false,
  };
}

export function getLinkSocialStatus(db: Database, linkId: number, userId: number): { liked: boolean; favorited: boolean } {
  return {
    liked: getUserLinkAction(db, linkId, userId, 'like'),
    favorited: getUserLinkAction(db, linkId, userId, 'favorite'),
  };
}

export interface DashboardLink extends Link {
  categories: Array<{ id: number; name: string }>;
}

export interface PaginatedDashboardLinks {
  data: DashboardLink[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export function getDashboardLinks(
  db: Database,
  userId: number,
  {
    page = 1,
    limit = 20,
    category_id,
    search,
    sort = 'created_at',
    order = 'desc',
  }: {
    page?: number;
    limit?: number;
    category_id?: number;
    search?: string;
    sort?: string;
    order?: string;
  }
): PaginatedDashboardLinks {
  const offset = (page - 1) * limit;

  const validSortFields = ['created_at', 'views_count', 'likes_count', 'saves_count', 'name'];
  const sortField = validSortFields.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  let whereClause = 'WHERE l.user_id = ?';
  const params: any[] = [userId];

  if (category_id) {
    whereClause += ' AND lc.category_id = ?';
    params.push(category_id);
  }

  if (search) {
    whereClause += ' AND l.name LIKE ?';
    params.push(`%${search}%`);
  }

  const links = db.query(`
    SELECT 
      l.id, l.user_id, l.name, l.url, l.short_code, l.is_public,
      l.likes_count, l.saves_count, l.views_count, l.created_at, l.updated_at,
      GROUP_CONCAT(DISTINCT c.id || ':' || c.name, ',') as category_list
    FROM links l
    ${category_id || search ? 'LEFT JOIN link_categories lc ON l.id = lc.link_id' : ''}
    LEFT JOIN link_categories lc_all ON l.id = lc_all.link_id
    LEFT JOIN categories c ON lc_all.category_id = c.id
    ${whereClause}
    GROUP BY l.id
    ORDER BY l.${sortField} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  const dashboardLinks: DashboardLink[] = links.map((link) => ({
    id: link.id,
    user_id: link.user_id,
    name: link.name,
    url: link.url,
    short_code: link.short_code,
    is_public: link.is_public,
    likes_count: link.likes_count,
    saves_count: link.saves_count,
    views_count: link.views_count,
    created_at: link.created_at,
    updated_at: link.updated_at,
    short_url: `${process.env.APP_URL || 'http://localhost:3000'}/r/${link.short_code}`,
    categories: link.category_list
      ? link.category_list.split(',').map((cat: string) => {
          const [id, name] = cat.split(':');
          return { id: parseInt(id), name };
        })
      : [],
  }));

  const countResult = db.query(`
    SELECT COUNT(DISTINCT l.id) as total
    FROM links l
    ${category_id || search ? 'LEFT JOIN link_categories lc ON l.id = lc.link_id' : ''}
    ${whereClause}
  `).get(...params) as { total: number };

  return {
    data: dashboardLinks,
    meta: {
      page,
      limit,
      total: countResult.total,
    },
  };
}

export function getPublicLinks(db: Database, limit = 6): Link[] {
  const links = db.query(`
    SELECT 
      l.id, l.user_id, l.name, l.url, l.short_code, l.is_public,
      l.likes_count, l.saves_count, l.views_count, l.created_at, l.updated_at
    FROM links l
    WHERE l.is_public = 1
    ORDER BY l.created_at DESC
    LIMIT ?
  `).all(limit) as Link[];

  return links.map((link) => ({
    ...link,
    short_url: `${process.env.APP_URL || 'http://localhost:3000'}/r/${link.short_code}`,
  }));
}
