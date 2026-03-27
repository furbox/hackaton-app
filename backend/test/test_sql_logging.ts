/**
 * Test with production Better Auth config + SQL logging
 */

import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { getDatabase } from "./db/connection.js";

const db = getDatabase();

// Patch to log SQL
const originalPrepare = db.prepare.bind(db);
db.prepare = function(sql: string) {
  console.log("\n🔍 Preparing SQL:", sql);
  const stmt = originalPrepare(sql);

  const originalAll = stmt.all.bind(stmt);
  stmt.all = function(...args: any[]) {
    console.log("   Parameters:", args.map((a, i) => `${i}: ${typeof a} = ${JSON.stringify(a)}`).join("\n              "));
    try {
      const result = originalAll(...args);
      console.log("   ✅ Success");
      return result;
    } catch (error) {
      console.error("   ❌ ERROR:", error);
      throw error;
    }
  };

  return stmt;
};

// Clean up
db.run("DELETE FROM users WHERE email = ?", ["prod-config-test@example.com"]);

console.log("🧪 Testing with PRODUCTION config + SQL logging...\n");

// Use production config with all fixes
const testAuth = betterAuth({
  database: db,
  databaseType: "sqlite",
  secret: "test-secret-32-characters-long-for-security!!",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: false,
  },
  user: {
    modelName: "users",
    fields: {
      email: "email",
      name: "username",
      emailVerified: "email_verified",
      image: "avatar_url",
      password: "password_hash",
      createdAt: "created_at",
      updatedAt: "created_at",
    },
    additionalFields: {
      bio: { type: "string", required: false },
      rank_id: { type: "number", required: false, defaultValue: 1, input: false },
    },
  },
  session: {
    modelName: "sessions",
    expiresIn: 60 * 60 * 24 * 7,
    cookieCache: { enabled: false },
    storeSessionInDatabase: true,
  },
  advanced: {
    useSecureCookies: false,
    crossSubDomainCookies: { enabled: false },
    database: {
      generateId: "serial", // KEY FIX: Use database auto-increment
    },
  },
  plugins: [admin()],
});

testAuth.api.signUpEmail({
  body: {
    name: "prodtestuser",
    email: "prod-config-test@example.com",
    password: "testPassword123!",
  },
  headers: new Headers(),
  returnHeaders: true,
}).then((result) => {
  console.log("\n✅ Registration successful!");
  console.log("   User:", result.response.user?.email);

  // Cleanup
  db.run("DELETE FROM users WHERE email = ?", ["prod-config-test@example.com"]);
  console.log("\n🧹 Cleaned up");
}).catch((error: any) => {
  console.error("\n❌ Registration failed:", error.message);
  process.exit(1);
});
