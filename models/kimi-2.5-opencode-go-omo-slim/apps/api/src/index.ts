import { Hono } from 'hono';
import { createDB } from './db';
import type { Database } from './db/types';
import type { Kysely } from 'kysely';
import { RateTicker } from './durable-objects/rate-ticker';
import { seedMiddleware } from './middleware/seed';
import { fetchAndStoreRates, notifyRateTicker } from './services/rate-fetcher';

// Import routes
import currenciesRoute from './routes/currencies';
import convertRoute from './routes/convert';
import ratesRoute from './routes/rates';
import rateHistoryRoute from './routes/rate-history';

// Define environment bindings
interface Env {
  DB: D1Database;
  RATE_TICKER: DurableObjectNamespace;
  ASSETS: Fetcher;
}

// Create Hono app
const app = new Hono<{ Bindings: Env; Variables: { db: Kysely<Database> } }>();

// Middleware to inject DB
app.use(async (c, next) => {
  const db = createDB(c.env.DB);
  c.set('db', db);
  await next();
});

// Seed middleware for API routes
app.use('/api/*', seedMiddleware);

// API routes
app.route('/api/available_currencies', currenciesRoute);
app.route('/api/convert', convertRoute);
app.route('/api/rates', ratesRoute);
app.route('/api/rate_history', rateHistoryRoute);

// WebSocket upgrade endpoint
app.get('/ws', async (c) => {
  const id = c.env.RATE_TICKER.idFromName('singleton');
  const stub = c.env.RATE_TICKER.get(id);
  return stub.fetch(c.req.raw);
});



// Catch-all: delegate to ASSETS binding for SPA
app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// Re-export Durable Object class
export { RateTicker };

// Default export with both fetch and scheduled handlers
export default {
  fetch: app.fetch,
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Running scheduled rate fetch...');
    
    try {
      const db = createDB(env.DB);
      await fetchAndStoreRates(db);
      
      // Notify RateTicker to broadcast updates
      await notifyRateTicker(env.RATE_TICKER);
      
      console.log('Scheduled rate fetch completed successfully');
    } catch (error) {
      console.error('Scheduled rate fetch failed:', error);
    }
  },
};
