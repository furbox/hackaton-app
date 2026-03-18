import { customAlphabet } from 'nanoid';
import Database from 'bun:sqlite';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nanoid = customAlphabet(alphabet, 7);

export function generateShortCode(db: Database, maxRetries = 3): string {
  for (let i = 0; i < maxRetries; i++) {
    const code = nanoid();
    const exists = db.query('SELECT id FROM links WHERE short_code = ?').get(code);
    if (!exists) return code;
  }
  throw new Error('Short code collision after max retries');
}
