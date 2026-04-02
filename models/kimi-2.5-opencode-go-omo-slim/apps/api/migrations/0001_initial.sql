-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fiat', 'crypto')),
  provider TEXT NOT NULL
);

-- Create rates table
CREATE TABLE IF NOT EXISTS rates (
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  rate REAL NOT NULL,
  provider TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source, target)
);

-- Create rate_history table
CREATE TABLE IF NOT EXISTS rate_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  rate REAL NOT NULL,
  provider TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

-- Create index for rate history queries
CREATE INDEX IF NOT EXISTS idx_rate_history_lookup ON rate_history(source, target, recorded_at);
