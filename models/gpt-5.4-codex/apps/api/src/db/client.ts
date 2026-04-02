import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import type { Database } from "./types";

const clients = new WeakMap<D1Database, Kysely<Database>>();

export const createDb = (database: D1Database): Kysely<Database> => {
  const cached = clients.get(database);
  if (cached) {
    return cached;
  }

  const client = new Kysely<Database>({
    dialect: new D1Dialect({ database })
  });

  clients.set(database, client);
  return client;
};

