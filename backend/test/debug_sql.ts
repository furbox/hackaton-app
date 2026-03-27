/**
 * Debug Better Auth SQL queries
 */

import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { getDatabase } from "./db/connection.js";

// Patch the database to log queries
const originalDb = getDatabase();
const originalRun = originalDb.run.bind(originalDb);
const originalExec = originalDb.exec.bind(originalDb);

originalDb.run = function(...args: any[]) {
  console.log("🔍 db.run():", args[0]);
  try {
    return originalRun(...args);
  } catch (error) {
    console.error("❌ db.run() ERROR:", error);
    throw error;
  }
};

originalDb.exec = function(...args: any[]) {
  console.log("🔍 db.exec():", args[0]);
  try {
    return originalExec(...args);
  } catch (error) {
    console.error("❌ db.exec() ERROR:", error);
    throw error;
  }
};

// Create test auth config
const testAuth = betterAuth({
  database: originalDb,
  databaseType: "sqlite",
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: "users",
    fields: {
      email: "email",
      name: "username",
      emailVerified: "email_verified",
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
    fields: {
      userId: "user_id",
      token: "token_jti",
      expiresAt: "expires_at",
    },
    additionalFields: {
      fingerprint: { type: "string", required: true },
    },
  },
  plugins: [admin()],
});

console.log("\n🧪 Testing registration with SQL logging...\n");

testAuth.api.signUpEmail({
  body: {
    name: "testuser",
    email: "test@example.com",
    password: "testPassword123!",
  },
  headers: new Headers(),
  returnHeaders: true,
}).catch((error) => {
  console.error("\n❌ Registration failed:", error.message);
  console.error("   This should show the SQL that caused the error above");
}).finally(() => {
  console.log("\n✅ Debug complete");
  process.exit(0);
});
