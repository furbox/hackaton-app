/**
 * Test Better Auth with minimal configuration
 */

import { betterAuth } from "better-auth";
import { getDatabase } from "./db/connection.js";

const db = getDatabase();

// Clean up
db.run("DELETE FROM users WHERE email = ?", ["minimal-test@example.com"]);

console.log("🧪 Testing with MINIMAL Better Auth config...\n");

const minimalAuth = betterAuth({
  database: db,
  databaseType: "sqlite",
  secret: "test-secret-minimal-config-32chars-long!!",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // DISABLE email verification
    autoSignIn: false,
  },
  user: {
    modelName: "users",
    fields: {
      email: "email",
      name: "username",
      emailVerified: "email_verified",
      image: "avatar_url",
      createdAt: "created_at",
      updatedAt: "created_at",
    },
    // NO additionalFields for now
  },
  session: {
    modelName: "sessions",
  },
});

minimalAuth.api.signUpEmail({
  body: {
    name: "minimaluser",
    email: "minimal-test@example.com",
    password: "testPassword123!",
  },
  headers: new Headers(),
  returnHeaders: true,
}).then((result) => {
  console.log("✅ SUCCESS with minimal config!");
  console.log("   User ID:", result.response.user?.id);
  console.log("   Email:", result.response.user?.email);

  // Check database
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get("minimal-test@example.com");
  console.log("   User in DB:", !!user);

  // Cleanup
  db.run("DELETE FROM users WHERE email = ?", ["minimal-test@example.com"]);
  console.log("\n🧹 Cleaned up");

  console.log("\n✅ CONCLUSION: The issue is with field mappings or emailVerified handling!");
}).catch((error: any) => {
  console.error("❌ FAILED even with minimal config");
  console.error("   Error:", error.message);
  if (error.cause) {
    console.error("   Cause:", error.cause);
  }
  process.exit(1);
});
