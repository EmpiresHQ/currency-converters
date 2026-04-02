import { Hono } from 'hono';
import { RateTicker } from './durable-objects/rate-ticker';

export { RateTicker };

interface Env {
  DB: D1Database;
  RATE_TICKER: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/api/available_currencies', async (c) => {
  try {
    const results = await c.env.DB.prepare('SELECT code, name, type FROM currencies').all();
    return c.json({ currencies: results.results });
  } catch {
    return c.json({ currencies: [] });
  }
});

app.post('/api/convert', async (c) => {
  const body = await c.req.json<{ from: string; to: string; amount: number }>();
  const { from, to, amount } = body;

  // Try direct rate
  const direct = await c.env.DB.prepare(
    'SELECT rate FROM rates WHERE source = ? AND target = ?'
  ).bind(from, to).first<{ rate: number }>();

  if (direct) {
    return c.json({
      from,
      to,
      amount,
      result: amount * direct.rate,
      rate: direct.rate,
      via_usd: false,
    });
  }

  // Try via USD
  const toUsd = await c.env.DB.prepare(
    'SELECT rate FROM rates WHERE source = ? AND target = ?'
  ).bind(from, 'USD').first<{ rate: number }>();
  const fromUsd = await c.env.DB.prepare(
    'SELECT rate FROM rates WHERE source = ? AND target = ?'
  ).bind('USD', to).first<{ rate: number }>();

  if (toUsd && fromUsd) {
    const result = amount * toUsd.rate * fromUsd.rate;
    return c.json({
      from,
      to,
      amount,
      result,
      rate: toUsd.rate * fromUsd.rate,
      via_usd: true,
    });
  }

  return c.json({ error: 'No conversion rate available' }, 400);
});

app.get('/api/rate_history', async (c) => {
  try {
    const results = await c.env.DB.prepare(
      'SELECT source, target, rate, recorded_at FROM rate_history ORDER BY recorded_at DESC LIMIT 100'
    ).all();
    return c.json({ history: results.results });
  } catch {
    return c.json({ history: [] });
  }
});

app.get('/ws', async (c) => {
  const id = c.env.RATE_TICKER.idFromName('default');
  const stub = c.env.RATE_TICKER.get(id);
  return stub.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    const now = new Date().toISOString();

    // Fetch fiat rates from ExchangeRate-API
    try {
      const fiatRes = await fetch('https://open.er-api.com/v6/latest/USD');
      const fiatData = (await fiatRes.json()) as { rates: Record<string, number> };
      if (fiatData.rates) {
        const fiatCurrencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];
        for (const code of fiatCurrencies) {
          if (fiatData.rates[code]) {
            await env.DB.prepare(
              'INSERT INTO rates (source, target, rate, provider, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(source, target) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at'
            ).bind('USD', code, fiatData.rates[code], 'exchangerate-api', now).run();
            await env.DB.prepare(
              'INSERT INTO rate_history (source, target, rate, provider, recorded_at) VALUES (?, ?, ?, ?, ?)'
            ).bind('USD', code, fiatData.rates[code], 'exchangerate-api', now).run();
          }
        }
        // Seed currencies table
        await env.DB.prepare('INSERT OR IGNORE INTO currencies (code, name, type, provider) VALUES (?, ?, ?, ?)').bind('USD', 'US Dollar', 'fiat', 'exchangerate-api').run();
        for (const code of fiatCurrencies) {
          await env.DB.prepare('INSERT OR IGNORE INTO currencies (code, name, type, provider) VALUES (?, ?, ?, ?)').bind(code, code, 'fiat', 'exchangerate-api').run();
        }
      }
    } catch (e) {
      console.error('Fiat fetch error:', e);
    }

    // Fetch crypto rates from CoinGecko
    try {
      const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple&vs_currencies=usd');
      const cryptoData = (await cryptoRes.json()) as Record<string, { usd: number }>;
      const cryptoMap: Record<string, string> = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', ripple: 'XRP' };
      for (const [id, code] of Object.entries(cryptoMap)) {
        if (cryptoData[id]?.usd) {
          await env.DB.prepare(
            'INSERT INTO rates (source, target, rate, provider, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(source, target) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at'
          ).bind(code, 'USD', cryptoData[id].usd, 'coingecko', now).run();
          await env.DB.prepare(
            'INSERT INTO rate_history (source, target, rate, provider, recorded_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(code, 'USD', cryptoData[id].usd, 'coingecko', now).run();
          await env.DB.prepare('INSERT OR IGNORE INTO currencies (code, name, type, provider) VALUES (?, ?, ?, ?)').bind(code, id, 'crypto', 'coingecko').run();
        }
      }
    } catch (e) {
      console.error('Crypto fetch error:', e);
    }

    // Notify Durable Object to broadcast
    try {
      const doId = env.RATE_TICKER.idFromName('default');
      const stub = env.RATE_TICKER.get(doId);
      await stub.fetch(new Request('https://internal/broadcast', { method: 'POST' }));
    } catch (e) {
      console.error('DO broadcast error:', e);
    }
  },
};
