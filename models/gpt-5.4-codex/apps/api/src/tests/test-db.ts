import { Miniflare } from "miniflare";

import { createDb } from "../db/client";

const SCHEMA_STATEMENTS = [
  "CREATE TABLE currencies (code TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('fiat', 'crypto')), provider TEXT NOT NULL)",
  "CREATE TABLE rates (source TEXT NOT NULL, target TEXT NOT NULL, rate REAL NOT NULL, provider TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(source, target))",
  "CREATE TABLE rate_history (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, target TEXT NOT NULL, rate REAL NOT NULL, provider TEXT NOT NULL, recorded_at TEXT NOT NULL)"
];

export const createTestDatabase = async () => {
  const miniflare = new Miniflare({
    d1Databases: ["DB"],
    host: "127.0.0.1",
    inspectorPort: 9230,
    liveReload: false,
    modules: true,
    port: 8789,
    script: "export default { fetch() { return new Response('ok'); } };"
  });

  const rawDb = await miniflare.getD1Database("DB");
  for (const statement of SCHEMA_STATEMENTS) {
    await rawDb.exec(statement);
  }

  return {
    db: createDb(rawDb),
    dispose: async () => {
      await miniflare.dispose();
    },
    rawDb
  };
};
