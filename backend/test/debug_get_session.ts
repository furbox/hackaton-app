/**
 * Debug script to test what Better Auth's getSession actually returns
 */

import { authConfig } from "../auth/config.js";

async function testGetSession() {
  console.log("🔍 Testing Better Auth getSession()...\n");

  // Test 1: No session cookie
  console.log("Test 1: Request with NO session cookie");
  const noSessionRequest = new Request("http://localhost:3000/api/test", {
    headers: new Headers(),
  });

  const session1 = await authConfig.api.getSession({
    headers: noSessionRequest.headers,
  });

  console.log("  Result:", session1);
  console.log("  Type:", typeof session1);
  console.log("  Keys:", session1 ? Object.keys(session1) : "N/A");
  if (session1?.user) {
    console.log("  User keys:", Object.keys(session1.user));
    console.log("  User ID type:", typeof session1.user.id);
    console.log("  User ID value:", session1.user.id);
  }

  console.log("\n" + "=".repeat(60) + "\n");

  // Test 2: With fake session token
  console.log("Test 2: Request with FAKE session cookie");
  const fakeSessionRequest = new Request("http://localhost:3000/api/test", {
    headers: new Headers({
      Cookie: "urlft_session=fake-token-12345",
    }),
  });

  const session2 = await authConfig.api.getSession({
    headers: fakeSessionRequest.headers,
  });

  console.log("  Result:", session2);
  console.log("  Type:", typeof session2);
  console.log("  Keys:", session2 ? Object.keys(session2) : "N/A");
  if (session2?.user) {
    console.log("  User keys:", Object.keys(session2.user));
    console.log("  User ID type:", typeof session2.user.id);
    console.log("  User ID value:", session2.user.id);
  }

  console.log("\n✅ Debug complete!");
}

testGetSession().catch(console.error);
