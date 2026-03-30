import { Database } from "bun:sqlite";

const db = new Database("./database.sqlite");

const missing = [
  "001_add_admin_fields.sql",
  "003_better_auth_tables.sql",
  "005_make_password_hash_nullable.sql",
];

for (const name of missing) {
  db.run("INSERT OR IGNORE INTO _migrations (name) VALUES (?)", [name]);
  console.log("✅ Registered:", name);
}

const state = db.query("SELECT name FROM _migrations ORDER BY name").all();
console.log("\n📋 Final state of _migrations:");
console.log(state);

db.close();
console.log("\n🎉 Done! Restart backend with: pm2 restart urloft-backend");
