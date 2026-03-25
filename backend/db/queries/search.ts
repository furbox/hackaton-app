/**
 * FTS5 Full-Text Search Queries
 *
 * Uses SQLite FTS5 virtual table `links_fts` to search across title,
 * description, URL, and extracted content.
 *
 * @module backend/db/queries/search
 */

import { getDatabase } from "../../db/connection.ts";
import type { Link } from "./links.ts";

// ============================================================================
// PREPARED STATEMENT FACTORIES
// ============================================================================

const getDb = () => getDatabase();

const searchLinksStmt = () => getDb().prepare(`
  SELECT
    l.*,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f.user_id) as favorites_count
  FROM links l
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f ON l.id = f.link_id
  WHERE l.id IN (
    SELECT rowid FROM links_fts WHERE links_fts MATCH ?
  )
  GROUP BY l.id
  ORDER BY l.created_at DESC
`);

const searchLinksWithCategoryStmt = () => getDb().prepare(`
  SELECT
    l.*,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f.user_id) as favorites_count
  FROM links l
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f ON l.id = f.link_id
  WHERE l.id IN (
    SELECT rowid FROM links_fts WHERE links_fts MATCH ?
  )
  AND l.category_id = ?
  GROUP BY l.id
  ORDER BY l.created_at DESC
`);

// ============================================================================
// SEARCH QUERIES
// ============================================================================

/**
 * Performs full-text search on links using SQLite FTS5.
 *
 * Searches across title, description, URL, and extracted content.
 * Returns results with engagement metrics (likes, favorites).
 *
 * @param query - FTS5 search query (supports boolean operators, quotes, etc.)
 * @param filters - Optional filters (category filtering)
 * @returns Array of matching links with engagement metrics
 *
 * @example
 * ```typescript
 * // Simple search
 * const results = searchLinks("javascript tutorial");
 *
 * // Boolean search
 * const results2 = searchLinks("react OR vue");
 *
 * // Phrase search
 * const results3 = searchLinks('"machine learning"');
 *
 * // With category filter
 * const results4 = searchLinks("api", { category_id: 5 });
 * ```
 */
export function searchLinks(
  query: string,
  filters?: { category_id?: number }
): (Link & { likes_count: number; favorites_count: number })[] {
  if (filters?.category_id !== undefined) {
    const stmt = searchLinksWithCategoryStmt();
    return stmt.all(query, filters.category_id) as (Link & { likes_count: number; favorites_count: number })[];
  }

  const stmt = searchLinksStmt();
  return stmt.all(query) as (Link & { likes_count: number; favorites_count: number })[];
}
