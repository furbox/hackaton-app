import Database from 'bun:sqlite';

export type BadgeType = 'iron' | 'bronze' | 'silver' | 'gold' | 'diamond';

export interface UserBadge {
  id: number;
  user_id: number;
  badge_type: BadgeType;
  earned_at: string;
}

const RANK_THRESHOLDS: Record<BadgeType, number> = {
  iron: 1,
  bronze: 10,
  silver: 100,
  gold: 1000,
  diamond: 1000000,
};

function calculateRank(publicLinkCount: number): BadgeType {
  if (publicLinkCount >= RANK_THRESHOLDS.diamond) return 'diamond';
  if (publicLinkCount >= RANK_THRESHOLDS.gold) return 'gold';
  if (publicLinkCount >= RANK_THRESHOLDS.silver) return 'silver';
  if (publicLinkCount >= RANK_THRESHOLDS.bronze) return 'bronze';
  return 'iron';
}

export function recalculateRank(db: Database, userId: number): BadgeType {
  const result = db.query(`
    SELECT COUNT(*) as count
    FROM links
    WHERE user_id = ? AND is_public = 1
  `).get(userId) as { count: number } | undefined;

  const publicCount = result?.count || 0;
  const newRank = calculateRank(publicCount);

  db.query(`
    UPDATE users
    SET rank = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newRank, userId);

  const existingBadge = db.query(`
    SELECT id FROM user_badges
    WHERE user_id = ? AND badge_type = ?
  `).get(userId, newRank) as { id: number } | undefined;

  if (!existingBadge) {
    db.query(`
      INSERT INTO user_badges (user_id, badge_type)
      VALUES (?, ?)
    `).run(userId, newRank);
  }

  return newRank;
}

export function getUserBadges(db: Database, userId: number): UserBadge[] {
  return db.query(`
    SELECT id, user_id, badge_type, earned_at
    FROM user_badges
    WHERE user_id = ?
    ORDER BY earned_at ASC
  `).all(userId) as UserBadge[];
}

export function getPublicUserBadges(db: Database, username: string): UserBadge[] {
  const user = db.query(`
    SELECT id FROM users WHERE username = ?
  `).get(username) as { id: number } | undefined;

  if (!user) {
    return [];
  }

  return db.query(`
    SELECT id, user_id, badge_type, earned_at
    FROM user_badges
    WHERE user_id = ?
    ORDER BY earned_at ASC
  `).all(user.id) as UserBadge[];
}

export interface UserRankInfo {
  rank: BadgeType;
  public_link_count: number;
  badges: UserBadge[];
}

export function getUserRankInfo(db: Database, userId: number): UserRankInfo {
  const user = db.query(`
    SELECT rank, (
      SELECT COUNT(*)
      FROM links
      WHERE user_id = ? AND is_public = 1
    ) as public_link_count
    FROM users
    WHERE id = ?
  `).get(userId, userId) as { rank: BadgeType; public_link_count: number } | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  const badges = getUserBadges(db, userId);

  return {
    rank: user.rank,
    public_link_count: user.public_link_count,
    badges,
  };
}

export function getPublicUserRankInfo(db: Database, username: string): UserRankInfo | null {
  const user = db.query(`
    SELECT u.id, u.rank, (
      SELECT COUNT(*)
      FROM links
      WHERE user_id = u.id AND is_public = 1
    ) as public_link_count
    FROM users u
    WHERE u.username = ?
  `).get(username) as { id: number; rank: BadgeType; public_link_count: number } | undefined;

  if (!user) {
    return null;
  }

  const badges = getPublicUserBadges(db, username);

  return {
    rank: user.rank,
    public_link_count: user.public_link_count,
    badges,
  };
}
