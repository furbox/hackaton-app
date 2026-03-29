#!/usr/bin/env bun
// Script para verificar datos de status_code en la DB

import { Database } from "bun:sqlite";

const db = new Database("backend/db/database.sqlite");

// Buscar links con status_code
const linksWithStatus = db.query(`
  SELECT id, title, url, status_code
  FROM links
  WHERE status_code IS NOT NULL
  LIMIT 10
`).all();

console.log("\n=== LINKS CON STATUS_CODE ===");
console.log(`Total encontrados: ${linksWithStatus.length}`);
console.table(linksWithStatus);

// Buscar todos los links para ver si tienen status_code
const allLinks = db.query(`
  SELECT id, title, status_code,
    CASE WHEN status_code IS NULL THEN 'SIN STATUS'
    WHEN status_code >= 200 AND status_code < 300 THEN 'OK'
    WHEN status_code >= 300 AND status_code < 400 THEN 'REDIRECT'
    WHEN status_code >= 400 AND status_code < 500 THEN 'CLIENT ERROR'
    WHEN status_code >= 500 THEN 'SERVER ERROR'
    END as status_category
  FROM links
  ORDER BY id DESC
  LIMIT 15
`).all();

console.log("\n=== ÚLTIMOS 15 LINKS (con categoría de status) ===");
console.table(allLinks);

// Conteos
const nullCount = db.query("SELECT COUNT(*) as count FROM links WHERE status_code IS NULL").get() as { count: number };
const notNullCount = db.query("SELECT COUNT(*) as count FROM links WHERE status_code IS NOT NULL").get() as { count: number };

console.log(`\n=== ESTADÍSTICAS ===`);
console.log(`Links con status_code: ${notNullCount.count}`);
console.log(`Links sin status_code: ${nullCount.count}`);

db.close();
