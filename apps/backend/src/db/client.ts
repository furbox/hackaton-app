import Database from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/hackaton.db';

// Ensure data directory exists
try {
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
} catch (err) {
  // Directory might already exist, ignore error
}

const db = new Database(DATABASE_PATH);

// Enable WAL mode for better concurrency
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export default db;
