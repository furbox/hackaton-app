import Database from 'bun:sqlite';
import type { BadgeType } from '../badges/badges.service';
import { getPublicUserBadges } from '../badges/badges.service';

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  rank: BadgeType;
  created_at: string;
  updated_at: string;
}

export interface PublicProfile {
  id: number;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  rank: BadgeType;
  public_link_count: number;
  created_at: string;
}

export interface UpdateProfileData {
  username?: string;
  bio?: string;
  avatar_url?: string | null;
}

export function getOwnProfile(db: Database, userId: number): UserProfile {
  const user = db
    .query(`
      SELECT id, username, email, avatar_url, bio, rank, created_at, updated_at
      FROM users
      WHERE id = ?
    `)
    .get(userId) as UserProfile | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

export function updateProfile(
  db: Database,
  userId: number,
  data: UpdateProfileData
): UserProfile {
  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (data.username !== undefined) {
    const existing = db.query('SELECT id FROM users WHERE username = ? AND id != ?').get(
      data.username,
      userId
    ) as { id: number } | undefined;

    if (existing) {
      throw new Error('Username already taken');
    }

    updates.push('username = ?');
    values.push(data.username);
  }

  if (data.bio !== undefined) {
    if (data.bio.length > 280) {
      throw new Error('Bio must be 280 characters or less');
    }
    updates.push('bio = ?');
    values.push(data.bio);
  }

  if (data.avatar_url !== undefined) {
    updates.push('avatar_url = ?');
    values.push(data.avatar_url);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(userId.toString());

  db.query(`
    UPDATE users
    SET ${updates.join(', ')}, updated_at = datetime('now')
    WHERE id = ?
  `).run(...values);

  return getOwnProfile(db, userId);
}

export function getPublicProfile(db: Database, username: string): PublicProfile | null {
  const user = db
    .query(`
      SELECT u.id, u.username, u.avatar_url, u.bio, u.rank, u.created_at,
             (SELECT COUNT(*) FROM links WHERE user_id = u.id AND is_public = 1) as public_link_count
      FROM users u
      WHERE u.username = ?
    `)
    .get(username) as PublicProfile | undefined;

  if (!user) {
    return null;
  }

  return user;
}

export function getPublicProfileLinks(
  db: Database,
  username: string,
  page = 1,
  limit = 20
): { links: Array<any>; meta: { page: number; limit: number; total: number } } {
  const user = db.query('SELECT id FROM users WHERE username = ?').get(username) as
    | { id: number }
    | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  const offset = (page - 1) * limit;

  const links = db
    .query(`
      SELECT l.id, l.name, l.short_code, l.url, l.views_count, l.likes_count, l.saves_count, l.created_at
      FROM links l
      WHERE l.user_id = ? AND l.is_public = 1
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(user.id, limit, offset) as any[];

  const totalResult = db
    .query('SELECT COUNT(*) as total FROM links WHERE user_id = ? AND is_public = 1')
    .get(user.id) as { total: number };

  return {
    links,
    meta: {
      page,
      limit,
      total: totalResult.total,
    },
  };
}
