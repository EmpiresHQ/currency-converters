import { Hono } from 'hono';
import type { Env } from '../env';
import { createDb } from '../db/database';

const rateHistory = new Hono<{ Bindings: Env }>();

rateHistory.get('/rate_history', async (c) => {
  const source = c.req.query('source');
  const target = c.req.query('target');
  const limit = parseInt(c.req.query('limit') || '60', 10);

  const db = createDb(c.env.DB);

  let query = db
    .selectFrom('rate_history')
    .select(['source', 'target', 'rate', 'recorded_at'])
    .orderBy('recorded_at', 'desc')
    .limit(Math.min(limit, 200));

  if (source) query = query.where('source', '=', source);
  if (target) query = query.where('target', '=', target);

  const rows = await query.execute();
  return c.json(rows.reverse());
});

export { rateHistory };
