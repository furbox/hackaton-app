import { getDatabase } from "./db/connection.js";

const db = getDatabase();

console.log("🔄 Temporarily making password_hash nullable...\n");

// SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
db.run(`
  CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,                    -- Made nullable
    avatar_url TEXT,
    bio TEXT,
    rank_id INTEGER NOT NULL DEFAULT 1,
    email_verified INTEGER DEFAULT 0,
    verification_token TEXT,
    verification_expires DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    role TEXT DEFAULT 'user',
    banned INTEGER DEFAULT 0,
    ban_reason TEXT,
    ban_expires DATETIME,
    FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE RESTRICT
  );
`);

// Copy data from old table
db.run(`
  INSERT INTO users_new 
  SELECT * FROM users
`);

// Drop old table and rename new one
db.run("DROP TABLE users");
db.run("ALTER TABLE users_new RENAME TO users");

console.log("✅ password_hash is now nullable");
console.log("\n📋 Updated schema:");
const columns = db.query("PRAGMA table_info(users)").all();
columns.forEach((col: any) => {
  if (col.name === "password_hash") {
    console.log(`   - ${col.name} (${col.type}) ${col.notnull ? "NOT NULL" : "NULLABLE"}`);
  }
});
