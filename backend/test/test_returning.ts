import { getDatabase } from "./db/connection.js";

const db = getDatabase();

console.log("🧪 Testing RETURNING clause with ID field...\n");

// Clean up
db.run("DELETE FROM users WHERE email = ?", ["returning-test@example.com"]);

try {
  // Test 1: INSERT without id field (should work)
  console.log("Test 1: INSERT WITHOUT id field");
  const sql1 = `INSERT INTO users (username, email, password_hash, email_verified, created_at)
                VALUES (?, ?, ?, ?, ?) RETURNING *`;
  const result1 = db.prepare(sql1).get(
    "testuser1",
    "returning-test@example.com",
    "hash",
    0,
    new Date().toISOString()
  );
  console.log("✅ SUCCESS:", result1 ? "Returning works" : "No result");

  // Cleanup
  db.run("DELETE FROM users WHERE email = ?", ["returning-test@example.com"]);

  // Test 2: INSERT WITH id field set to null (should fail?)
  console.log("\nTest 2: INSERT WITH id=null");
  const sql2 = `INSERT INTO users (id, username, email, password_hash, email_verified, created_at)
                VALUES (?, ?, ?, ?, ?, ?) RETURNING *`;
  try {
    const result2 = db.prepare(sql2).get(
      null,
      "testuser2",
      "returning-test@example.com",
      "hash",
      0,
      new Date().toISOString()
    );
    console.log("✅ SUCCESS: Insert with id=null worked");
    db.run("DELETE FROM users WHERE email = ?", ["returning-test@example.com"]);
  } catch (e: any) {
    console.log("❌ FAILED with id=null:", e.message);
  }

} catch (error) {
  console.error("❌ Test failed:", error);
}
