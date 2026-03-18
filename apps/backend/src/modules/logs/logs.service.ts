import Database from 'bun:sqlite';
import { hashIP } from '../../utils/hash';

export interface LogEntry {
  id: number;
  link_id: number;
  ip_hash: string;
  action: 'view' | 'like' | 'favorite';
  created_at: string;
}

export function logVisit(db: Database, linkId: number, rawIp: string): void {
  const ipHash = hashIP(rawIp);

  db.query(`
    INSERT INTO link_logs (link_id, ip_hash, action, created_at)
    VALUES (?, ?, 'view', datetime('now'))
  `).run(linkId, ipHash);

  db.query('UPDATE links SET views_count = views_count + 1 WHERE id = ?').run(linkId);
}

export function logLike(db: Database, linkId: number, userId: number): void {
  const userHash = hashIP(userId.toString());

  const existing = db.query(`
    SELECT id FROM link_logs
    WHERE link_id = ? AND ip_hash = ? AND action = 'like'
  `).get(linkId, userHash) as { id: number } | undefined;

  if (existing) {
    throw new Error('already_liked');
  }

  db.query(`
    INSERT INTO link_logs (link_id, ip_hash, action, created_at)
    VALUES (?, ?, 'like', datetime('now'))
  `).run(linkId, userHash);

  db.query('UPDATE links SET likes_count = likes_count + 1 WHERE id = ?').run(linkId);
}

export function removeLike(db: Database, linkId: number, userId: number): void {
  const userHash = hashIP(userId.toString());

  const result = db.query(`
    DELETE FROM link_logs
    WHERE link_id = ? AND ip_hash = ? AND action = 'like'
  `).run(linkId, userHash);

  if (result.changes === 0) {
    throw new Error('like_not_found');
  }

  db.query('UPDATE links SET likes_count = likes_count - 1 WHERE id = ?').run(linkId);
}

export function logFavorite(db: Database, linkId: number, userId: number): void {
  const userHash = hashIP(userId.toString());

  const existing = db.query(`
    SELECT id FROM link_logs
    WHERE link_id = ? AND ip_hash = ? AND action = 'favorite'
  `).get(linkId, userHash) as { id: number } | undefined;

  if (existing) {
    throw new Error('already_favorited');
  }

  db.query(`
    INSERT INTO link_logs (link_id, ip_hash, action, created_at)
    VALUES (?, ?, 'favorite', datetime('now'))
  `).run(linkId, userHash);

  db.query('UPDATE links SET saves_count = saves_count + 1 WHERE id = ?').run(linkId);
}

export function removeFavorite(db: Database, linkId: number, userId: number): void {
  const userHash = hashIP(userId.toString());

  const result = db.query(`
    DELETE FROM link_logs
    WHERE link_id = ? AND ip_hash = ? AND action = 'favorite'
  `).run(linkId, userHash);

  if (result.changes === 0) {
    throw new Error('favorite_not_found');
  }

  db.query('UPDATE links SET saves_count = saves_count - 1 WHERE id = ?').run(linkId);
}

export function getUserLinkAction(db: Database, linkId: number, userId: number, action: 'like' | 'favorite'): boolean {
  const userHash = hashIP(userId.toString());

  const existing = db.query(`
    SELECT id FROM link_logs
    WHERE link_id = ? AND ip_hash = ? AND action = ?
  `).get(linkId, userHash, action) as { id: number } | undefined;

  return !!existing;
}
