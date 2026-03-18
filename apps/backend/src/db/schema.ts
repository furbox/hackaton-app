import Database from 'bun:sqlite';

export function initializeSchema(db: Database) {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      password_hash TEXT NOT NULL,
      avatar_url    TEXT,
      bio           TEXT,
      rank          TEXT NOT NULL DEFAULT 'iron'
                    CHECK(rank IN ('iron','bronze','silver','gold','diamond')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  // Links table
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      url           TEXT NOT NULL,
      short_code    TEXT NOT NULL UNIQUE,
      is_public     INTEGER NOT NULL DEFAULT 1,
      likes_count   INTEGER NOT NULL DEFAULT 0,
      saves_count   INTEGER NOT NULL DEFAULT 0,
      views_count   INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
    CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);
    CREATE INDEX IF NOT EXISTS idx_links_is_public ON links(is_public);
    CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at);
  `);

  // Categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      description   TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
  `);

  // Link categories pivot table
  db.exec(`
    CREATE TABLE IF NOT EXISTS link_categories (
      link_id       INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      PRIMARY KEY (link_id, category_id)
    )
  `);

  // Link logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS link_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id       INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      ip_hash       TEXT NOT NULL,
      action        TEXT NOT NULL CHECK(action IN ('view','like','favorite')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_link_logs_link_id ON link_logs(link_id);
    CREATE INDEX IF NOT EXISTS idx_link_logs_created_at ON link_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_link_logs_action ON link_logs(action);
  `);

  // User badges table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_badges (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_type    TEXT NOT NULL
                  CHECK(badge_type IN ('iron','bronze','silver','gold','diamond')),
      earned_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, badge_type)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
  `);

  // Email verifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token         TEXT NOT NULL UNIQUE,
      expires_at    TEXT NOT NULL,
      used_at       TEXT
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
    CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
  `);
}
