import { getDatabase } from "./db/connection.js";

const db = getDatabase();

// Checkpoint WAL to ensure main file is up to date
db.exec("PRAGMA wal_checkpoint(TRUNCATE);");

console.log("=== Users Table Schema ===");
const usersColumns = db.query("PRAGMA table_info(users)").all();
console.table(usersColumns);

console.log("\n=== Sessions Table Schema ===");
const sessionsColumns = db.query("PRAGMA table_info(sessions)").all();
console.table(sessionsColumns);

console.log("\n=== Testing Registration ===");
console.log("The issue was:");
console.log("1. Better Auth expects 'user' table (singular)");
console.log("2. Database has 'users' table (plural)");
console.log("3. Tables were in WAL file but not checkpointed");
console.log("\nFix applied:");
console.log("1. Added databaseType: 'sqlite' to auth config");
console.log("2. Added user.modelName: 'users' to auth config");
console.log("3. Added session.modelName: 'sessions' to auth config");
console.log("4. Checkpointed WAL file");
