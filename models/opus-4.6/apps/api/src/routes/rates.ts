import { Hono } from 'hono';
import type { Env } from '../env';
import { createDb } from '../db/database';

const rates = new Hono<{ Bindings: Env }>();

rates.get('/rates', async (c) => {
  const pairsParam = c.req.query('pairs');
  if (!pairsParam) {
    return c.json({ error: 'Missing pairs query parameter' }, 400);
  }

  const db = createDb(c.env.DB);
  const pairs = pairsParam.split(',').map((p) => p.trim());
  const results: Array<{ pair: string; rate: number; updated_at: string }> = [];

  for (const pair of pairs) {
    const [source, target] = pair.split('/');
    if (!source || !target) continue;

    const direct = await db
      .selectFrom('rates')
      .select(['rate', 'updated_at'])
      .where('source', '=', source)
      .where('target', '=', target)
      .executeTakeFirst();

    if (direct) {
      results.push({ pair, rate: direct.rate, updated_at: direct.updated_at });
      continue;
    }

    const inverse = await db
      .selectFrom('rates')
      .select(['rate', 'updated_at'])
      .where('source', '=', target)
      .where('target', '=', source)
      .executeTakeFirst();

    if (inverse) {
      results.push({ pair, rate: 1 / inverse.rate, updated_at: inverse.updated_at });
    }
  }

  return c.json(results);
});

export { rates };
