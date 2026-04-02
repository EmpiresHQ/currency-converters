import { Hono } from 'hono';
import type { Env } from '../env';
import { createDb } from '../db/database';

const currencies = new Hono<{ Bindings: Env }>();

currencies.get('/available_currencies', async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .selectFrom('currencies')
    .select(['code', 'name', 'type'])
    .orderBy('type')
    .orderBy('code')
    .execute();

  return c.json(rows);
});

export { currencies };
