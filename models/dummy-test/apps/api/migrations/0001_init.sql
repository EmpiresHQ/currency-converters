CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rates (
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  rate REAL NOT NULL,
  provider TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source, target)
);

CREATE TABLE IF NOT EXISTS rate_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  rate REAL NOT NULL,
  provider TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
