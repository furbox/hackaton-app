import { getDatabase } from "./db/connection.js";

const db = getDatabase();

// Drop Better Auth auto-created tables that conflict with custom schema
const tablesToDrop = ["account", "verification"];

tablesToDrop.forEach((table) => {
  try {
    db.run(`DROP TABLE IF EXISTS ${table}`);
    console.log(`✅ Dropped table: ${table}`);
  } catch (error) {
    console.error(`❌ Failed to drop ${table}:`, error);
  }
});

// Verify remaining tables
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log("\nRemaining tables:");
tables.forEach((t: any) => console.log("  -", t.name));
