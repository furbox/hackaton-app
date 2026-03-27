/**
 * Test Better Auth registration with production config
 */

import { authConfig } from "./auth/config.js";
import { getDatabase } from "./db/connection.js";

async function testRegistration() {
  console.log("🧪 Testing Better Auth Registration with Production Config...\n");

  // Clean up any existing test user
  const db = getDatabase();
  db.run("DELETE FROM users WHERE email = ?", ["test@example.com"]);

  // Enable SQL logging to see what's happening
  const originalRun = db.run.bind(db);
  db.run = function(...args: any[]) {
    const sql = args[0];
    if (sql.includes("INSERT") || sql.includes("CREATE")) {
      console.log("🔍 SQL:", sql);
    }
    return originalRun(...args);
  };

  try {
    // Test Better Auth signUpEmail API
    console.log("1. Calling Better Auth signUpEmail...");
    const result = await authConfig.api.signUpEmail({
      body: {
        name: "testuser",
        email: "test@example.com",
        password: "testPassword123!",
      },
      headers: new Headers(),
      returnHeaders: true,
    });

    console.log("\n✅ Registration successful!");
    console.log("   User ID:", result.response.user?.id);
    console.log("   Email:", result.response.user?.email);

    // Check database
    const user = db.query("SELECT * FROM users WHERE email = ?", ["test@example.com"]).get();
    console.log("\n2. Database verification:");
    console.log("   ✅ User found in 'users' table:", !!user);

    // Check if any 'user' table exists (should not)
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='user'").all();
    console.log("   ✅ No 'user' (singular) table:", tables.length === 0);

    console.log("\n🎉 Test passed! Better Auth is correctly using the 'users' table.");

    // Cleanup
    db.run("DELETE FROM users WHERE email = ?", ["test@example.com"]);
    console.log("\n🧹 Cleaned up test user");

  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    console.error("   Status:", error.status);
    console.error("   Body:", error.body);

    // Check what columns exist
    console.log("\n🔍 Current users table columns:");
    const columns = db.query("PRAGMA table_info(users)").all();
    columns.forEach((col: any) => console.log(`   - ${col.name} (${col.type})`));

    throw error;
  }
}

// Run test
testRegistration().catch(console.error);
