-- Mazos EUNACOM servidos por D1
CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_version TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deck_blocks (
  deck_id TEXT NOT NULL,
  file TEXT NOT NULL,
  hash TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (deck_id, file)
);

CREATE TABLE IF NOT EXISTS deck_cards (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL,
  block_file TEXT NOT NULL,
  position INTEGER NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deck_cards_block
  ON deck_cards (deck_id, block_file, position);

CREATE TABLE IF NOT EXISTS deck_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
