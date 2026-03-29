-- ============================================
-- URLoft Database Schema
-- ============================================
-- This file contains the complete database schema for URLoft.
--
-- IMPORTANT NOTE: SQLite requires PRAGMA foreign_keys = ON; to be executed
-- in each database connection for ON DELETE CASCADE/SET NULL to work properly.
--
-- Usage:
--   1. Open SQLite connection
--   2. Execute: PRAGMA foreign_keys = ON;
--   3. Read and execute this schema file
-- ============================================

-- Ranks table
-- Stores user rank levels with gamification metadata
CREATE TABLE ranks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,                  -- Internal name: newbie, active, power_user, legend, god_mode
  min_links INTEGER NOT NULL,                 -- Minimum links to reach this rank
  max_links INTEGER,                          -- Maximum links for this rank (NULL for unlimited)
  display_name TEXT NOT NULL,                 -- Human-readable name with emoji: "🌱 Newbie"
  badge_url TEXT,                             -- URL to badge/icon image
  color TEXT DEFAULT '#6366f1',              -- Hex color for UI
  description TEXT,                           -- Rank description
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial rank data
INSERT INTO ranks (id, name, min_links, max_links, display_name, badge_url, color, description) VALUES
(1, 'newbie', 0, 10, '🌱 Newbie', '/badges/newbie.svg', '#6366f1', 'Just getting started with your link collection.'),
(2, 'active', 11, 50, '⚡ Active', '/badges/active.svg', '#3b82f6', 'Contributing regularly to the community.'),
(3, 'power_user', 51, 150, '🔥 Power User', '/badges/power.svg', '#f59e0b', 'Link master in the making with valuable contributions.'),
(4, 'legend', 151, 500, '💎 Legend', '/badges/legend.svg', '#8b5cf6', 'Respected community member with an impressive collection.'),
(5, 'god_mode', 500, NULL, '👑 GOD Mode', '/badges/god.svg', '#ec4899', 'Untouchable link royalty - you are the URLoft master.');

-- Users table
-- Stores all user accounts with authentication and profile information
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  avatar_url TEXT,
  bio TEXT,
  rank_id INTEGER NOT NULL DEFAULT 1,        -- Foreign key reference to ranks table (default: newbie)
  email_verified INTEGER DEFAULT 0,           -- SQLite uses INTEGER for BOOLEAN (0 = false, 1 = true)
  verification_token TEXT,
  verification_expires DATETIME,              -- Expiry timestamp for verification token (24h from generation)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE RESTRICT
);

-- Password Resets table
-- Stores password recovery tokens with expiration
CREATE TABLE password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,                     -- SQLite uses INTEGER for BOOLEAN
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Categories table
-- User-defined categories for organizing links
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)
);

-- Links table
-- Stores all saved links with metadata and statistics
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  short_code TEXT UNIQUE NOT NULL,
  is_public INTEGER DEFAULT 1,                -- SQLite uses INTEGER for BOOLEAN
  category_id INTEGER,
  views INTEGER DEFAULT 0,
  og_title TEXT,                              -- Open Graph title (auto-extracted)
  og_description TEXT,                        -- Open Graph description (auto-extracted)
  og_image TEXT,                              -- Open Graph image URL (auto-extracted)
  status_code INTEGER DEFAULT 200,            -- HTTP status code for Link Rot detection
  archive_url TEXT,                           -- Wayback Machine copy URL
  content_text TEXT,                          -- Extracted content for Reader Mode and FTS5
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  UNIQUE(user_id, url)
);

-- Full-Text Search Table
-- Virtual table for fast full-text search on links using FTS5
CREATE VIRTUAL TABLE links_fts USING fts5(
  title,
  description,
  url,
  content_text,
  content='links',
  content_rowid='id'
);

-- FTS5 Configuration Notes:
-- - content='links': FTS5 mirrors data from the links table (external content table)
-- - content_rowid='id': Maps FTS5 rowid to links.id for correlation
-- - This is an external content table, meaning it doesn't duplicate data
-- - Triggers (defined below) will keep this table in sync automatically

-- ============================================
-- FTS5 Synchronization Triggers
-- ============================================
-- IMPORTANT: These triggers are REQUIRED because SQLite FTS5 does NOT automatically
-- update the full-text search index when the underlying links table changes.
--
-- Without these triggers, any INSERT, UPDATE, or DELETE on the links table would
-- leave the links_fts index out of sync, causing search to return stale or missing results.
--
-- The triggers use the external content table configuration, which means:
-- - INSERT trigger: Adds new rows to the FTS5 index
-- - DELETE trigger: Removes rows from the FTS5 index using the special 'delete' command
-- - UPDATE trigger: Deletes the old version and inserts the new version
-- ============================================

-- Trigger: links_ai (AFTER INSERT)
-- Fires when a new link is inserted, adding it to the FTS5 index
CREATE TRIGGER links_ai AFTER INSERT ON links BEGIN
  INSERT INTO links_fts(rowid, title, description, url, content_text)
  VALUES (new.id, new.title, new.description, new.url, new.content_text);
END;

-- Trigger: links_ad (AFTER DELETE)
-- Fires when a link is deleted, removing it from the FTS5 index
CREATE TRIGGER links_ad AFTER DELETE ON links BEGIN
  INSERT INTO links_fts(links_fts, rowid, title, description, url, content_text)
  VALUES('delete', old.id, old.title, old.description, old.url, old.content_text);
END;

-- Trigger: links_au (AFTER UPDATE)
-- Fires when a link is updated, replacing the old FTS5 entry with the new data
CREATE TRIGGER links_au AFTER UPDATE ON links BEGIN
  INSERT INTO links_fts(links_fts, rowid, title, description, url, content_text)
  VALUES('delete', old.id, old.title, old.description, old.url, old.content_text);
  INSERT INTO links_fts(rowid, title, description, url, content_text)
  VALUES (new.id, new.title, new.description, new.url, new.content_text);
END;

-- Likes table
-- Tracks user likes on links (junction table)
CREATE TABLE likes (
  user_id INTEGER NOT NULL,
  link_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, link_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Favorites table
-- Tracks user favorited links (junction table)
CREATE TABLE favorites (
  user_id INTEGER NOT NULL,
  link_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, link_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Sessions table
-- Stores active user sessions with JWT fingerprint for security
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_jti TEXT UNIQUE NOT NULL,             -- Unique JWT ID
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  fingerprint TEXT NOT NULL,                  -- hash(IP + User-Agent)
  is_active INTEGER DEFAULT 1,                -- SQLite uses INTEGER for BOOLEAN
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit Logs table
-- Tracks security events for compliance and monitoring
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,                            -- Nullable to allow system events
  event TEXT NOT NULL,                        -- login, logout, token_rejected, password_change, etc.
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,                              -- JSON with additional details
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API Keys table
-- Stores API keys for MCP Server and Web Skill authentication
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,                         -- Descriptive name (e.g., "Claude Desktop")
  key_hash TEXT UNIQUE NOT NULL,              -- Hashed API key (never stored in plain text)
  key_prefix TEXT NOT NULL,                   -- First 8 chars for identification (e.g., "urlk_a1b2")
  permissions TEXT DEFAULT 'read',            -- 'read' or 'read+write'
  last_used_at DATETIME,
  expires_at DATETIME,
  is_active INTEGER DEFAULT 1,                -- SQLite uses INTEGER for BOOLEAN
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
-- Performance optimization indexes for common queries

-- Index for rank lookups on users
CREATE INDEX idx_users_rank_id ON users(rank_id);

-- Indexes for audit logs queries
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
