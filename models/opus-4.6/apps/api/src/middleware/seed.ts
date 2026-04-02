import { createMiddleware } from 'hono/factory';
import type { Env } from '../env';
import { createDb } from '../db/database';
import { fetchAndStoreRates } from '../services/rate-fetcher';

let seeded = false;

export const seedMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!seeded) {
    const db = createDb(c.env.DB);

    const fiatCount = await db
      .selectFrom('currencies')
      .select(db.fn.count<number>('code').as('count'))
      .where('type', '=', 'fiat')
      .executeTakeFirstOrThrow();

    const cryptoCount = await db
      .selectFrom('currencies')
      .select(db.fn.count<number>('code').as('count'))
      .where('type', '=', 'crypto')
      .executeTakeFirstOrThrow();

    if (Number(fiatCount.count) === 0 || Number(cryptoCount.count) === 0) {
      await fetchAndStoreRates(db);

      // Broadcast seeded rates to connected WebSocket clients
      try {
        const allRates = await db
          .selectFrom('rates')
          .select(['source', 'target', 'rate', 'updated_at'])
          .execute();

        const id = c.env.RATE_TICKER.idFromName('global');
        const stub = c.env.RATE_TICKER.get(id);
        await stub.fetch(new Request('https://internal/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'rates', data: allRates }),
        }));
      } catch {
        // DO broadcast failure during seed is non-critical
      }
    }

    seeded = true;
  }

  await next();
});
