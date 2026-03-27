import { getDatabase } from "./db/connection.js";

const db = getDatabase();

console.log("🔍 Testing different query methods...\n");

// Clean up
db.run("DELETE FROM users WHERE email = ?", ["test-query@example.com"]);

// Insert
db.run(`
  INSERT INTO users (username, email, password_hash, rank_id, email_verified, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`, ["testquery", "test-query@example.com", "hash", 1, 0, new Date().toISOString()]);

console.log("✅ Inserted test user\n");

// Method 1: db.query().get()
console.log("Method 1: db.query().get()");
try {
  const user1 = db.query("SELECT * FROM users WHERE email = ?", ["test-query@example.com"]).get();
  console.log("  Result:", user1 ? "✅ Found" : "❌ NOT FOUND");
} catch (e) {
  console.log("  ❌ Error:", e);
}

// Method 2: db.prepare().get()
console.log("\nMethod 2: db.prepare().get()");
try {
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const user2 = stmt.get("test-query@example.com");
  console.log("  Result:", user2 ? "✅ Found" : "❌ NOT FOUND");
} catch (e) {
  console.log("  ❌ Error:", e);
}

// Method 3: db.prepare().get() with array parameter
console.log("\nMethod 3: db.prepare().get() with array");
try {
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const user3 = stmt.get(["test-query@example.com"]);
  console.log("  Result:", user3 ? "✅ Found" : "❌ NOT FOUND");
} catch (e) {
  console.log("  ❌ Error:", e);
}

// Show all users
console.log("\n📋 All users:");
const all = db.query("SELECT email FROM users").all();
all.forEach((u: any) => console.log("  -", u.email));

// Cleanup
db.run("DELETE FROM users WHERE email = ?", ["test-query@example.com"]);
console.log("\n🧹 Cleaned up");
