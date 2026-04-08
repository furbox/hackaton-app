-- Shortlink telemetry migration
-- Stores per-redirect visit events while preserving aggregate links.views counter.

CREATE TABLE IF NOT EXISTS link_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  user_id INTEGER,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_link_views_link_id_visited_at
  ON link_views(link_id, visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_link_views_visited_at
  ON link_views(visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_link_views_user_id_visited_at
  ON link_views(user_id, visited_at DESC);
