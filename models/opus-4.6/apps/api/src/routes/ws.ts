import { Hono } from 'hono';
import type { Env } from '../env';

const ws = new Hono<{ Bindings: Env }>();

ws.get('/ws', async (c) => {
  const id = c.env.RATE_TICKER.idFromName('global');
  const stub = c.env.RATE_TICKER.get(id);
  return stub.fetch(c.req.raw);
});

export { ws };
