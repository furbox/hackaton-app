import { Database } from "bun:sqlite";
const db = new Database("backend/db/database.sqlite");
const columns = db.query("PRAGMA table_info(users)").all();
console.log(JSON.stringify(columns, null, 2));
