import { getDatabase } from "./db/connection.js";

const db = getDatabase();

console.log("🔄 Adding password column to account table...\n");

// SQLite doesn't support ADD COLUMN with a default value in a single statement,
// so we need to recreate the table again
db.run("DROP TABLE IF EXISTS account");

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
    password TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

console.log("✅ account table recreated with password column");

// Show schema
const columns = db.query("PRAGMA table_info(account)").all();
console.log("\n📋 Account table schema:");
columns.forEach((col: any) => {
  console.log(`   - ${col.name} (${col.type})`);
});
