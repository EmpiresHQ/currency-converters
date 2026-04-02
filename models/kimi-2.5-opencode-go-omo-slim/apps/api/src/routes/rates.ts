import { Hono } from 'hono';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { ratesQuerySchema } from '../validation/schemas';

const app = new Hono<{
  Bindings: { DB: D1Database };
  Variables: { db: Kysely<Database> };
}>();

app.get('/', async (c) => {
  const db = c.get('db');
  const pairsParam = c.req.query('pairs');
  
  if (!pairsParam) {
    return c.json({ error: 'Missing pairs parameter' }, 400);
  }
  
  let pairs: string;
  try {
    const parsed = ratesQuerySchema.parse({ pairs: pairsParam });
    pairs = parsed.pairs;
  } catch {
    return c.json({ error: 'Invalid pairs parameter' }, 400);
  }

  const pairList = pairs.split(',').map(p => p.trim().toUpperCase());
  const results: Record<string, { rate: number; source: string; target: string }> = {};

  for (const pair of pairList) {
    const [source, target] = pair.split('/');
    
    if (!source || !target) {
      continue;
    }

    // Try direct rate
    const direct = await db
      .selectFrom('rates')
      .select(['rate', 'source as src', 'target as tgt'])
      .where('source', '=', source)
      .where('target', '=', target)
      .executeTakeFirst();

    if (direct) {
      results[pair] = { rate: direct.rate, source: direct.src, target: direct.tgt };
      continue;
    }

    // Try inverse
    const inverse = await db
      .selectFrom('rates')
      .select(['rate', 'source as src', 'target as tgt'])
      .where('source', '=', target)
      .where('target', '=', source)
      .executeTakeFirst();

    if (inverse && inverse.rate !== 0) {
      results[pair] = { 
        rate: 1 / inverse.rate, 
        source,
        target,
      };
    }
  }

  return c.json({ rates: results });
});

export default app;
