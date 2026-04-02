import { Hono } from 'hono';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { convertSchema } from '../validation/schemas';
import { convertCurrency } from '../services/converter';

const app = new Hono<{
  Bindings: { DB: D1Database };
  Variables: { db: Kysely<Database> };
}>();

app.post('/', async (c) => {
  const db = c.get('db');
  
  let body;
  try {
    body = await c.req.json();
    const parsed = convertSchema.parse(body);
    body = parsed;
  } catch (error) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  // Verify currencies exist
  const [sourceCurrency, targetCurrency] = await Promise.all([
    db.selectFrom('currencies')
      .select('code')
      .where('code', '=', body.source.toUpperCase())
      .executeTakeFirst(),
    db.selectFrom('currencies')
      .select('code')
      .where('code', '=', body.target.toUpperCase())
      .executeTakeFirst(),
  ]);

  if (!sourceCurrency) {
    return c.json({ error: `Unknown currency: ${body.source}` }, 400);
  }
  if (!targetCurrency) {
    return c.json({ error: `Unknown currency: ${body.target}` }, 400);
  }

  const source = body.source.toUpperCase();
  const target = body.target.toUpperCase();

  const result = await convertCurrency(db, source, target, body.amount);

  if (!result) {
    return c.json({ 
      error: `No conversion path found from ${source} to ${target}` 
    }, 400);
  }

  return c.json(result);
});

export default app;
