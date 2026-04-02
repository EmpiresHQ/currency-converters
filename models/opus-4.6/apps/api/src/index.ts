import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env';
import { seedMiddleware } from './middleware/seed';
import { currencies } from './routes/currencies';
import { convert } from './routes/convert';
import { rates } from './routes/rates';
import { rateHistory } from './routes/rate-history';
import { ws } from './routes/ws';
import { createDb } from './db/database';
import { fetchAndStoreRates } from './services/rate-fetcher';
import { RateTicker } from './durable-objects/rate-ticker';

export { RateTicker };

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors());
app.use('/api/*', seedMiddleware);

app.route('/api', currencies);
app.route('/api', convert);
app.route('/api', rates);
app.route('/api', rateHistory);
app.route('', ws);

// Catch-all: delegate to ASSETS binding for SPA
app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) => {
    const db = createDb(env.DB);
    await fetchAndStoreRates(db);

    const id = env.RATE_TICKER.idFromName('global');
    const stub = env.RATE_TICKER.get(id);

    const allRates = await db
      .selectFrom('rates')
      .select(['source', 'target', 'rate', 'updated_at'])
      .execute();

    await stub.fetch(new Request('https://internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'rates', data: allRates }),
    }));
  },
};
