-- Migration: 0001_init.sql
CREATE TABLE IF NOT EXISTS currencies (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('fiat', 'crypto')),
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

CREATE INDEX IF NOT EXISTS idx_rates_source_target ON rates(source, target);
CREATE INDEX IF NOT EXISTS idx_rate_history_pair ON rate_history(source, target, recorded_at);
