#!/usr/bin/env bun

import { Database } from "bun:sqlite";

const db = new Database("backend/db/database.sqlite");

// Get links with status_code
const links = db.query(`
  SELECT
    l.*,
    u.username AS owner_username,
    u.avatar_url AS owner_avatar_url,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f.user_id) as favorites_count,
    0 as liked_by_me,
    0 as favorited_by_me
  FROM links l
  INNER JOIN users u ON u.id = l.user_id
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f ON l.id = f.link_id
  WHERE l.is_public = 1
  GROUP BY l.id
  ORDER BY likes_count DESC
  LIMIT 6
`).all();

console.log("\n=== RAW LINKS FROM DB (camelCase simulation) ===");
links.forEach((link: any, idx) => {
  console.log(`\n[${idx}] Link ${link.id}: "${link.title}"`);
  console.log(`    status_code: ${link.status_code} (${typeof link.status_code})`);
  console.log(`    statusCode: ${link.statusCode} (${typeof link.statusCode})`);
  console.log(`    All keys: ${Object.keys(link).slice(0, 15).join(", ")}...`);
});

// Simular normalizeLink del frontend
function normalizeLink(raw: any) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof raw.id === "number" ? raw.id : null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const url = typeof raw.url === "string" && raw.url.trim().length > 0 ? raw.url : null;

  if (id === null || url === null) {
    return null;
  }

  return {
    id,
    title,
    url,
    description: typeof raw.description === "string" ? raw.description : undefined,
    short_code: typeof raw.short_code === "string" ? raw.short_code : undefined,
    likes_count: typeof raw.likes_count === "number" ? raw.likes_count : 0,
    favorites_count: typeof raw.favorites_count === "number" ? raw.favorites_count : 0,
    views: typeof raw.views === "number" ? raw.views : 0,
    liked_by_me: typeof raw.liked_by_me === "boolean" ? raw.liked_by_me : false,
    favorited_by_me: typeof raw.favorited_by_me === "boolean" ? raw.favorited_by_me : false,
    status_code:
      typeof raw.status_code === "number"
        ? raw.status_code
        : typeof raw.statusCode === "number"
          ? raw.statusCode
          : undefined,
    category: null,
  };
}

console.log("\n=== AFTER normalizeLink() ===");
const normalized = links.map(normalizeLink).filter(l => l !== null);
console.log(`Total normalized: ${normalized.length}`);
normalized.forEach((link: any, idx) => {
  console.log(`[${idx}] Link ${link.id}: status_code = ${link.status_code} (${typeof link.status_code})`);
});

db.close();
