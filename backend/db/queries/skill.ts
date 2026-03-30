import { getDatabase } from "../../db/connection.ts";

export interface SkillLinkMetadataRow {
  id: number;
  url: string;
  title: string;
  description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  category_id: number | null;
  category_name: string | null;
}

const getDb = () => getDatabase();

const getSkillLinkMetadataByIdVisibleToActorStmt = () =>
  getDb().prepare(`
    SELECT
      l.id,
      l.url,
      l.title,
      l.description,
      l.og_title,
      l.og_description,
      l.og_image,
      l.category_id,
      c.name AS category_name
    FROM links l
    LEFT JOIN categories c ON c.id = l.category_id
    WHERE l.id = ?
      AND (
        l.is_public = 1
        OR (? IS NOT NULL AND l.user_id = ?)
      )
    LIMIT 1
  `);

const getSkillLinkMetadataByUrlVisibleToActorStmt = () =>
  getDb().prepare(`
    SELECT
      l.id,
      l.url,
      l.title,
      l.description,
      l.og_title,
      l.og_description,
      l.og_image,
      l.category_id,
      c.name AS category_name
    FROM links l
    LEFT JOIN categories c ON c.id = l.category_id
    WHERE l.url = ?
      AND (
        l.is_public = 1
        OR (? IS NOT NULL AND l.user_id = ?)
      )
    ORDER BY
      CASE WHEN (? IS NOT NULL AND l.user_id = ?) THEN 0 ELSE 1 END,
      l.created_at DESC
    LIMIT 1
  `);

export function getSkillLinkMetadataByIdVisibleToActor(
  id: number,
  actorUserId?: number
): SkillLinkMetadataRow | null {
  const stmt = getSkillLinkMetadataByIdVisibleToActorStmt();
  return stmt.get(id, actorUserId ?? null, actorUserId ?? null) as SkillLinkMetadataRow | null;
}

export function getSkillLinkMetadataByUrlVisibleToActor(
  url: string,
  actorUserId?: number
): SkillLinkMetadataRow | null {
  const stmt = getSkillLinkMetadataByUrlVisibleToActorStmt();
  return stmt.get(
    url,
    actorUserId ?? null,
    actorUserId ?? null,
    actorUserId ?? null,
    actorUserId ?? null
  ) as SkillLinkMetadataRow | null;
}
