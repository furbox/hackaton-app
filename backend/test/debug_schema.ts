import { getDatabase } from '../db/connection.js';

const db = getDatabase();

console.log('=== USERS TABLE SCHEMA ===');
const userSchema = db.prepare("PRAGMA table_info(users)").all();
userSchema.forEach(col => console.log(`  ${col.name}: ${col.type}`));

console.log('\n=== SESSIONS TABLE SCHEMA ===');
const sessionSchema = db.prepare("PRAGMA table_info(sessions)").all();
sessionSchema.forEach(col => console.log(`  ${col.name}: ${col.type}`));

console.log('\n=== SAMPLE SESSION (if any) ===');
const sampleSession = db.prepare('SELECT * FROM sessions LIMIT 1').get();
if (sampleSession) {
  console.log('  Found session:', JSON.stringify(sampleSession, null, 2));
} else {
  console.log('  No sessions found in database');
}
