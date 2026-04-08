-- Migration 005: Make password_hash nullable (Safe version)
--
-- Better Auth creates users without password_hash when using OAuth or
-- when the user creation flow is handled internally by Better Auth.
-- The NOT NULL constraint was causing registration failures.
--
-- @version 005
-- @date 2026-03-29

-- SQLite does not support ALTER COLUMN directly.
-- We must recreate the table with the new constraint.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  avatar_url TEXT,
  bio TEXT,
  rank_id INTEGER NOT NULL DEFAULT 1,
  email_verified INTEGER DEFAULT 0,
  verification_token TEXT,
  verification_expires DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  role TEXT DEFAULT 'user',
  banned INTEGER DEFAULT 0,
  banReason TEXT,
  banExpires DATETIME,
  FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE RESTRICT
);

-- Copy data specifying all columns explicitly so it doesn't crash 
-- if the old table has different columns
-- NOTE: ban columns use camelCase because migration 002 added them as camelCase
INSERT INTO users_new (
  id, username, email, password_hash, avatar_url, bio, rank_id, 
  email_verified, verification_token, verification_expires, created_at,
  role, banned, banReason, banExpires
)
SELECT 
  id, username, email, password_hash, avatar_url, bio, rank_id, 
  email_verified, verification_token, verification_expires, created_at,
  role, banned, banReason, banExpires
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Restore the index
CREATE INDEX IF NOT EXISTS idx_users_rank_id ON users(rank_id);

PRAGMA foreign_keys = ON;
