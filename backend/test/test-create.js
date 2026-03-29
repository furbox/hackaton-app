import { getDatabase } from "./db/connection.js";
import { authConfig } from "./auth/config.js";

async function test() {
  const db = getDatabase();
  console.log("DB Path:", db.filename);
  
  try {
    const res = await authConfig.api.signUpEmail({
      body: {
        name: "testuser" + Date.now(),
        email: "test" + Date.now() + "@example.com",
        password: "password123",
      }
    });
    console.log("Success:", res);
  } catch (err) {
    console.error("Error details:", JSON.stringify(err, null, 2));
    console.error("Error message:", err.message);
  }
}

test();
