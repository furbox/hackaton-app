import { getDatabase } from "./db/connection.js";
import { readFileSync } from "fs";

const db = getDatabase();

// Read migration SQL
const migrationSQL = readFileSync("db/migrations/001_add_admin_fields.sql", "utf-8");

try {
  // Check if columns already exist by querying PRAGMA
  const tableInfo = db.query("PRAGMA table_info(users)").all();
  const hasRole = tableInfo.some((col: any) => col.name === "role");

  if (hasRole) {
    console.log("ℹ️  Migration already applied - admin fields exist");
  } else {
    db.exec(migrationSQL);
    console.log("✅ Migration applied: added admin fields to users table");
  }

  // Show current columns
  console.log("\nCurrent users table columns:");
  db.query("PRAGMA table_info(users)").all().forEach((col: any) => {
    console.log(`  - ${col.name} (${col.type})`);
  });
} catch (error) {
  console.error("❌ Migration failed:", error);
  process.exit(1);
}
