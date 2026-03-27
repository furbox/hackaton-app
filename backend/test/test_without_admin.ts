/**
 * Test Better Auth registration WITHOUT admin plugin
 */

import { betterAuth } from "better-auth";
import { getDatabase } from "./db/connection.js";

const db = getDatabase();

// Clean up test user
db.run("DELETE FROM users WHERE email = ?", ["test-noadmin@example.com"]);

// Create auth config WITHOUT admin plugin
const testAuth = betterAuth({
  database: db,
  databaseType: "sqlite",
  secret: "test-secret-for-debugging-only",
  emailAndPassword: {
    enabled: true,
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
    additionalFields: {
      bio: { type: "string", required: false },
      rank_id: { type: "number", required: false, defaultValue: 1 },
      verification_token: { type: "string", required: false },
      verification_expires: { type: "date", required: false },
    },
  },
  session: {
    modelName: "sessions",
    expiresIn: 60 * 60 * 24 * 7,
    cookieCache: { enabled: false },
    storeSessionInDatabase: true,
  },
  // NO ADMIN PLUGIN
});

console.log("🧪 Testing WITHOUT admin plugin...\n");

testAuth.api.signUpEmail({
  body: {
    name: "testnoadmin",
    email: "test-noadmin@example.com",
    password: "testPassword123!",
  },
  headers: new Headers(),
  returnHeaders: true,
}).then((result) => {
  console.log("✅ Registration successful WITHOUT admin plugin!");
  console.log("   User ID:", result.response.user?.id);
  console.log("   Email:", result.response.user?.email);

  // Cleanup
  db.run("DELETE FROM users WHERE email = ?", ["test-noadmin@example.com"]);
  console.log("\n🧹 Cleaned up test user");
  console.log("\n✅ Conclusion: The admin plugin is causing the datatype mismatch!");
}).catch((error) => {
  console.error("❌ Registration failed even WITHOUT admin plugin");
  console.error("   Error:", error.message);
  process.exit(1);
});
