-- Better Auth Required Tables Migration
-- This migration ensures the `account` and `verification` tables exist.
-- Better Auth manages its own schema automatically on startup, so this is just
-- a fallback for fresh databases before the app starts.

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope TEXT,
  idToken TEXT,
  password TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

-- Note: We do not force indexes here because Better Auth handles its own
-- schema sync, and depending on when the sync ran, the column names might
-- be camelCase or snake_case. This avoids the "no such column" crash.
