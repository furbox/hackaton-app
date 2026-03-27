import { getDatabase } from "./db/connection.js";

const db = getDatabase();

console.log("🔍 Investigating database behavior...\n");

// Clean up
db.run("DELETE FROM users WHERE email = ?", ["investigate@example.com"]);

// Insert a test user
const insertSql = `
  INSERT INTO users (username, email, password_hash, rank_id, email_verified, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`;

db.run(insertSql, ["invuser", "investigate@example.com", "hash", 1, 0, new Date().toISOString()]);

console.log("✅ Insert executed");

// Try to find the user - immediately
const user1 = db.query("SELECT * FROM users WHERE email = ?", ["investigate@example.com"]).get();
console.log("Query 1 (immediate):", user1 ? "Found" : "NOT FOUND");

// Try with different query syntax
const user2 = db.query("SELECT * FROM users WHERE username = ?", ["invuser"]).get();
console.log("Query 2 (by username):", user2 ? "Found" : "NOT FOUND");

// Try with LIKE
const user3 = db.query("SELECT * FROM users WHERE email LIKE ?", ["investigate%"]).get();
console.log("Query 3 (LIKE):", user3 ? "Found" : "NOT FOUND");

// List all users
const allUsers = db.query("SELECT email, username FROM users").all();
console.log("\nAll users in database:");
allUsers.forEach((u: any) => console.log(`  - ${u.email} (${u.username})`));

// Cleanup
db.run("DELETE FROM users WHERE email = ?", ["investigate@example.com"]);
console.log("\n🧹 Cleaned up");
