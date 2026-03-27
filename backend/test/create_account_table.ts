import { getDatabase } from "./db/connection.js";

const db = getDatabase();

console.log("🔄 Creating account table for admin plugin...\n");

// Create minimal account table for admin plugin
db.run(`
  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    expires_at DATETIME,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

console.log("✅ account table created");

// Verify table
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='account'").all();
console.log(`   Verified: ${tables.length === 1 ? "account table exists" : "account table missing"}`);
