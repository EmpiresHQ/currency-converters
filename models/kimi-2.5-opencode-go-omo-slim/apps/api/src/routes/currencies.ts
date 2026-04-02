import { Hono } from 'hono';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';

const app = new Hono<{
  Bindings: { DB: D1Database };
  Variables: { db: Kysely<Database> };
}>();

app.get('/', async (c) => {
  const db = c.get('db');
  
  const currencies = await db
    .selectFrom('currencies')
    .selectAll()
    .orderBy('type')
    .orderBy('code')
    .execute();

  return c.json({ currencies });
});

export default app;
