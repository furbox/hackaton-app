import { getDatabase } from "./db/connection.js";

const db = getDatabase();
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

console.log("Tables in database:");
tables.forEach((t: any) => console.log("  -", t.name));
