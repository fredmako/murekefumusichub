-- Buyer category preferences ("For You" weighting).
--
-- The frontend calls PUT/GET /api/purchases/preferences (src/services/api.ts
-- fypService.updatePreferences) but the table did not exist, so the endpoint
-- would fail at runtime. One row per (user, category); weight is a caller
-- supplied score used to rank recommendations.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS buyer_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT,
  weight REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_preferences_user_category
  ON buyer_preferences(user_id, category_id);

CREATE INDEX IF NOT EXISTS idx_buyer_preferences_user
  ON buyer_preferences(user_id);
