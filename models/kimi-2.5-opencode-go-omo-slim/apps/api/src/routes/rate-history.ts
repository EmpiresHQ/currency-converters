import { Hono } from 'hono';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { rateHistorySchema } from '../validation/schemas';

const app = new Hono<{
  Bindings: { DB: D1Database };
  Variables: { db: Kysely<Database> };
}>();

app.get('/', async (c) => {
  const db = c.get('db');
  
  const sourceParam = c.req.query('source');
  const targetParam = c.req.query('target');
  const limitParam = c.req.query('limit') || '100';
  
  if (!sourceParam || !targetParam) {
    return c.json({ error: 'Missing source or target parameter' }, 400);
  }
  
  let params;
  try {
    params = rateHistorySchema.parse({ 
      source: sourceParam, 
      target: targetParam, 
      limit: limitParam 
    });
  } catch {
    return c.json({ error: 'Invalid parameters' }, 400);
  }

  const upperSource = params.source.toUpperCase();
  const upperTarget = params.target.toUpperCase();

  // Get history for the pair (try both directions)
  const history = await db
    .selectFrom('rate_history')
    .selectAll()
    .where((eb) => eb.or([
      eb.and([
        eb('source', '=', upperSource),
        eb('target', '=', upperTarget),
      ]),
      eb.and([
        eb('source', '=', upperTarget),
        eb('target', '=', upperSource),
      ]),
    ]))
    .orderBy('recorded_at', 'desc')
    .limit(params.limit)
    .execute();

  // Normalize rates to the requested direction
  const normalized = history.map(h => {
    if (h.source === upperSource && h.target === upperTarget) {
      return {
        source: h.source,
        target: h.target,
        rate: h.rate,
        recorded_at: h.recorded_at,
      };
    } else {
      // Invert the rate
      return {
        source: upperSource,
        target: upperTarget,
        rate: h.rate !== 0 ? 1 / h.rate : 0,
        recorded_at: h.recorded_at,
      };
    }
  });

  return c.json({ 
    history: normalized.reverse(), // Return in chronological order
  });
});

export default app;
