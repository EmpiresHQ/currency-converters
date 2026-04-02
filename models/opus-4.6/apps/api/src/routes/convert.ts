import { Hono } from 'hono';
import type { Env } from '../env';
import { createDb } from '../db/database';
import { ConvertRequestSchema, type ConvertResponse } from '../schemas';

const convert = new Hono<{ Bindings: Env }>();

async function findRate(db: ReturnType<typeof createDb>, source: string, target: string): Promise<number | null> {
  const direct = await db
    .selectFrom('rates')
    .select('rate')
    .where('source', '=', source)
    .where('target', '=', target)
    .executeTakeFirst();
  if (direct) return direct.rate;

  const inverse = await db
    .selectFrom('rates')
    .select('rate')
    .where('source', '=', target)
    .where('target', '=', source)
    .executeTakeFirst();
  if (inverse) return 1 / inverse.rate;

  return null;
}

convert.post('/convert', async (c) => {
  const body = await c.req.json();
  const parsed = ConvertRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  const { source, target, amount } = parsed.data;
  const db = createDb(c.env.DB);

  if (source === target) {
    const response: ConvertResponse = {
      source, target, amount, result: amount, rate: 1, via_usd: false,
      timestamp: new Date().toISOString(),
    };
    return c.json(response);
  }

  const directRate = await findRate(db, source, target);
  if (directRate !== null) {
    const response: ConvertResponse = {
      source, target, amount, result: amount * directRate, rate: directRate, via_usd: false,
      timestamp: new Date().toISOString(),
    };
    return c.json(response);
  }

  const sourceToUsd = await findRate(db, source, 'USD');
  const usdToTarget = await findRate(db, 'USD', target);

  if (sourceToUsd !== null && usdToTarget !== null) {
    const rate = sourceToUsd * usdToTarget;
    const response: ConvertResponse = {
      source, target, amount, result: amount * rate, rate, via_usd: true,
      timestamp: new Date().toISOString(),
    };
    return c.json(response);
  }

  return c.json({ error: 'No conversion path found', source, target }, 404);
});

export { convert };
