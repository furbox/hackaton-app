import { getDatabase } from "./db/connection.js";

const db = getDatabase();

console.log("🔄 Renaming admin plugin columns to snake_case...\n");

try {
  // Rename banReason -> ban_reason
  db.run("ALTER TABLE users RENAME COLUMN banReason TO ban_reason");
  console.log("✅ Renamed: banReason → ban_reason");

  // Rename banExpires → ban_expires
  db.run("ALTER TABLE users RENAME COLUMN banExpires TO ban_expires");
  console.log("✅ Renamed: banExpires → ban_expires");

  // Show updated columns
  console.log("\n📋 Updated users table columns:");
  const columns = db.query("PRAGMA table_info(users)").all();
  columns.forEach((col: any) => console.log(`   - ${col.name} (${col.type})`));

  console.log("\n✅ Migration complete!");
} catch (error) {
  console.error("❌ Migration failed:", error);
  process.exit(1);
}
