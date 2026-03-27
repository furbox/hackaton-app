import { getDatabase } from "./db/connection.js";

const db = getDatabase();

console.log("🧪 Testing manual INSERT to find the datatype issue...\n");

// Clean up
db.run("DELETE FROM users WHERE email = ?", ["manual-test@example.com"]);

try {
  // Hash a password using Bun's native password hashing
  const passwordHash = await Bun.password.hash("testPassword123!");

  // Try inserting with all fields
  const sql = `
    INSERT INTO users (
      username, email, password_hash, avatar_url, bio,
      rank_id, email_verified, verification_token, verification_expires,
      created_at, role, banned
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    "manualuser",                    // username (TEXT)
    "manual-test@example.com",       // email (TEXT)
    passwordHash,                    // password_hash (TEXT)
    null,                            // avatar_url (TEXT)
    "Test bio",                      // bio (TEXT)
    1,                               // rank_id (INTEGER)
    0,                               // email_verified (INTEGER) - using 0 instead of false
    null,                            // verification_token (TEXT)
    null,                            // verification_expires (DATETIME)
    new Date().toISOString(),        // created_at (DATETIME)
    "user",                          // role (TEXT)
    0,                               // banned (INTEGER) - using 0 instead of false
  ];

  console.log("Executing INSERT with values:");
  console.log(values.map((v, i) => `${i}: ${typeof v} = ${JSON.stringify(v)}`).join("\n"));
  console.log();

  db.run(sql, values);

  console.log("✅ Manual INSERT successful!");

  // Verify the row was created
  const user = db.query("SELECT * FROM users WHERE email = ?", ["manual-test@example.com"]).get();
  console.log("✅ User found:", !!user);

  // Cleanup
  db.run("DELETE FROM users WHERE email = ?", ["manual-test@example.com"]);
  console.log("\n🧹 Cleaned up test user");

} catch (error) {
  console.error("❌ Manual INSERT failed:", error);
  process.exit(1);
}
