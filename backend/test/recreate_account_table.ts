import { getDatabase } from "./db/connection.js";

const db = getDatabase();

console.log("🔄 Recreating account table with correct schema...\n");

// Drop existing table
db.run("DROP TABLE IF EXISTS account");

// Create account table with Better Auth's expected schema (camelCase)
db.run(`
  CREATE TABLE account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId INTEGER NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    expiresAt DATETIME,
    password_hash TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

console.log("✅ account table created with camelCase fields");

// Show schema
const columns = db.query("PRAGMA table_info(account)").all();
console.log("\n📋 Account table schema:");
columns.forEach((col: any) => {
  console.log(`   - ${col.name} (${col.type})`);
});
