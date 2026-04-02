# Currency Converter App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack currency converter with FIAT + crypto support, real-time WebSocket rates, deployed on Cloudflare Workers + D1 + Durable Objects.

**Architecture:** Bun monorepo with `apps/api` (Hono Worker) and `apps/frontend` (React SPA via Vite). Rates fetched from fawazahmed0/exchange-api via cron, stored in D1 via Kysely, broadcast via Durable Object WebSockets. Frontend uses Zustand for state, Canvas sparklines for charts, Tailwind for styling.

**Tech Stack:** TypeScript, Hono, Kysely + kysely-d1, Zod, Cloudflare Workers/D1/Durable Objects, React, Vite, Tailwind CSS, Zustand, Bun

---

## File Structure

```
models/opus-4.6/
├── package.json                          # Root workspace config
├── report.json                           # Benchmark report
├── packages/config/
│   ├── package.json
│   ├── tsconfig.base.json
│   └── eslint.config.mjs
├── apps/api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml
│   ├── migrations/
│   │   └── 0001_init.sql
│   └── src/
│       ├── index.ts                      # Worker entry: fetch + scheduled exports
│       ├── env.ts                        # Env type definition
│       ├── db/
│       │   ├── types.ts                  # Kysely Database interface
│       │   └── database.ts              # createDb helper
│       ├── schemas/
│       │   └── index.ts                  # Zod schemas for all DTOs
│       ├── services/
│       │   └── rate-fetcher.ts           # Fetch rates from fawazahmed0 API
│       ├── middleware/
│       │   └── seed.ts                   # First-request DB seed middleware
│       ├── routes/
│       │   ├── currencies.ts             # GET /api/available_currencies
│       │   ├── convert.ts               # POST /api/convert
│       │   ├── rates.ts                 # GET /api/rates?pairs=...
│       │   ├── rate-history.ts          # GET /api/rate_history
│       │   └── ws.ts                    # GET /ws WebSocket upgrade
│       └── durable-objects/
│           └── rate-ticker.ts            # RateTicker DO class
├── apps/frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css                     # Tailwind directives
│       ├── vite-env.d.ts
│       ├── assets/
│       │   └── dollar-sign.svg
│       ├── store/
│       │   └── index.ts                  # Zustand store
│       └── components/
│           ├── Header.tsx
│           ├── RateDashboard.tsx
│           ├── RateCard.tsx
│           ├── Sparkline.tsx
│           ├── Converter.tsx
│           ├── CurrencyDropdown.tsx
│           ├── ResultDisplay.tsx
│           └── RecentConversions.tsx
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/config/eslint.config.mjs`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "currency-converter",
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
```

- [ ] **Step 2: Create packages/config/package.json**

```json
{
  "name": "@currency-converter/config",
  "private": true,
  "devDependencies": {
    "typescript": "^5.7.0",
    "eslint": "^9.0.0",
    "@eslint/js": "^9.0.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

- [ ] **Step 3: Create packages/config/tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react-jsx"
  }
}
```

- [ ] **Step 4: Create packages/config/eslint.config.mjs**

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.wrangler/'],
  }
);
```

- [ ] **Step 5: Install root dependencies**

```bash
cd models/opus-4.6 && bun install
```

---

## Task 2: API Scaffolding

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/wrangler.toml`

- [ ] **Step 1: Create apps/api/package.json**

```json
{
  "name": "@currency-converter/api",
  "private": true,
  "scripts": {
    "dev": "wrangler d1 migrations apply currency-converter-db --local && wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "kysely": "^0.27.0",
    "kysely-d1": "^0.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "wrangler": "^3.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create apps/api/tsconfig.json**

```json
{
  "extends": "../../packages/config/tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "outDir": "./dist",
    "lib": ["ES2022"],
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create apps/api/wrangler.toml**

```toml
name = "currency-converter-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./public"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = true

[[d1_databases]]
binding = "DB"
database_name = "currency-converter-db"
database_id = "local"
migrations_dir = "migrations"

[durable_objects]
bindings = [
  { name = "RATE_TICKER", class_name = "RateTicker" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["RateTicker"]

[triggers]
crons = ["*/1 * * * *"]
```

- [ ] **Step 4: Install API dependencies**

```bash
cd models/opus-4.6/apps/api && bun install
```

---

## Task 3: D1 Migration + Kysely Types

**Files:**
- Create: `apps/api/migrations/0001_init.sql`, `apps/api/src/db/types.ts`, `apps/api/src/db/database.ts`, `apps/api/src/env.ts`

- [ ] **Step 1: Create migration file**

```sql
-- Migration: 0001_init.sql
-- Create tables for currency converter

CREATE TABLE IF NOT EXISTS currencies (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('fiat', 'crypto')),
    provider TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rates (
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    rate REAL NOT NULL,
    provider TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(source, target)
);

CREATE TABLE IF NOT EXISTS rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    rate REAL NOT NULL,
    provider TEXT NOT NULL,
    recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rates_source_target ON rates(source, target);
CREATE INDEX IF NOT EXISTS idx_rate_history_pair ON rate_history(source, target, recorded_at);
```

- [ ] **Step 2: Create env.ts**

```typescript
import type { KyselyD1Database } from 'kysely-d1';

export interface Env {
  DB: D1Database;
  RATE_TICKER: DurableObjectNamespace;
  ASSETS: Fetcher;
}
```

- [ ] **Step 3: Create db/types.ts**

```typescript
import type { Generated } from 'kysely';

export interface CurrencyTable {
  code: string;
  name: string;
  type: 'fiat' | 'crypto';
  provider: string;
}

export interface RateTable {
  source: string;
  target: string;
  rate: number;
  provider: string;
  updated_at: string;
}

export interface RateHistoryTable {
  id: Generated<number>;
  source: string;
  target: string;
  rate: number;
  provider: string;
  recorded_at: string;
}

export interface Database {
  currencies: CurrencyTable;
  rates: RateTable;
  rate_history: RateHistoryTable;
}
```

- [ ] **Step 4: Create db/database.ts**

```typescript
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { Database } from './types';

export function createDb(d1: D1Database): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new D1Dialect({ database: d1 }),
  });
}
```

---

## Task 4: Zod Schemas

**Files:**
- Create: `apps/api/src/schemas/index.ts`

- [ ] **Step 1: Create all Zod schemas**

```typescript
import { z } from 'zod';

// External API response schemas
export const ExchangeRateResponseSchema = z.object({
  date: z.string(),
  usd: z.record(z.string(), z.number()),
});

export const CurrencyNamesResponseSchema = z.record(z.string(), z.string());

// API request schemas
export const ConvertRequestSchema = z.object({
  source: z.string().min(1).transform((s) => s.toUpperCase()),
  target: z.string().min(1).transform((s) => s.toUpperCase()),
  amount: z.number().positive(),
});

export const RatesQuerySchema = z.object({
  pairs: z.string().min(1),
});

// API response types
export type ConvertRequest = z.infer<typeof ConvertRequestSchema>;
export type ConvertResponse = {
  source: string;
  target: string;
  amount: number;
  result: number;
  rate: number;
  via_usd: boolean;
  timestamp: string;
};

export type CurrencyDto = {
  code: string;
  name: string;
  type: 'fiat' | 'crypto';
};

export type RateDto = {
  source: string;
  target: string;
  rate: number;
  updated_at: string;
};
```

---

## Task 5: Rate Fetcher Service

**Files:**
- Create: `apps/api/src/services/rate-fetcher.ts`

- [ ] **Step 1: Implement rate fetcher**

```typescript
import { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { ExchangeRateResponseSchema, CurrencyNamesResponseSchema } from '../schemas';

const RATES_URL = 'https://latest.currency-api.pages.dev/v1/currencies/usd.json';
const NAMES_URL = 'https://latest.currency-api.pages.dev/v1/currencies.json';

const FIAT_CODES = new Set([
  'usd', 'eur', 'gbp', 'jpy', 'chf', 'cad', 'aud', 'nzd',
  'cny', 'inr', 'brl', 'krw', 'mxn', 'sgd', 'hkd', 'nok',
  'sek', 'dkk', 'pln', 'zar', 'thb', 'idr', 'myr', 'php',
  'twd', 'czk', 'huf', 'ils', 'clp', 'aed', 'sar', 'try',
  'rub', 'ars', 'cop', 'egp', 'ngn', 'pkr', 'vnd', 'bdt',
]);

const CRYPTO_CODES = new Set(['btc', 'eth', 'sol', 'xrp']);

function isKnownCurrency(code: string): 'fiat' | 'crypto' | null {
  if (FIAT_CODES.has(code)) return 'fiat';
  if (CRYPTO_CODES.has(code)) return 'crypto';
  return null;
}

export async function fetchAndStoreRates(db: Kysely<Database>): Promise<void> {
  const [ratesResponse, namesResponse] = await Promise.all([
    fetch(RATES_URL),
    fetch(NAMES_URL),
  ]);

  if (!ratesResponse.ok || !namesResponse.ok) {
    throw new Error(`API fetch failed: rates=${ratesResponse.status}, names=${namesResponse.status}`);
  }

  const ratesData = ExchangeRateResponseSchema.parse(await ratesResponse.json());
  const namesData = CurrencyNamesResponseSchema.parse(await namesResponse.json());

  const now = new Date().toISOString();
  const usdRates = ratesData.usd;

  // Upsert currencies
  const currencyRows: Array<{ code: string; name: string; type: 'fiat' | 'crypto'; provider: string }> = [];
  // Always include USD
  currencyRows.push({ code: 'USD', name: namesData['usd'] || 'US Dollar', type: 'fiat', provider: 'fawazahmed0' });

  for (const [code, rate] of Object.entries(usdRates)) {
    const type = isKnownCurrency(code);
    if (!type) continue;
    const upperCode = code.toUpperCase();
    const name = namesData[code] || upperCode;
    currencyRows.push({ code: upperCode, name, type, provider: 'fawazahmed0' });
  }

  // Batch upsert currencies
  for (const row of currencyRows) {
    await db
      .insertInto('currencies')
      .values(row)
      .onConflict((oc) => oc.column('code').doUpdateSet({ name: row.name, type: row.type, provider: row.provider }))
      .execute();
  }

  // Upsert rates and insert history
  const rateRows: Array<{ source: string; target: string; rate: number; provider: string; updated_at: string }> = [];
  const historyRows: Array<{ source: string; target: string; rate: number; provider: string; recorded_at: string }> = [];

  for (const [code, rate] of Object.entries(usdRates)) {
    const type = isKnownCurrency(code);
    if (!type) continue;
    const upperCode = code.toUpperCase();

    if (type === 'fiat') {
      // Fiat: store as USD -> X
      rateRows.push({ source: 'USD', target: upperCode, rate, provider: 'fawazahmed0', updated_at: now });
      historyRows.push({ source: 'USD', target: upperCode, rate, provider: 'fawazahmed0', recorded_at: now });
    } else {
      // Crypto: invert. API gives 1 USD = X crypto, we want X -> USD
      const invertedRate = 1 / rate;
      rateRows.push({ source: upperCode, target: 'USD', rate: invertedRate, provider: 'fawazahmed0', updated_at: now });
      historyRows.push({ source: upperCode, target: 'USD', rate: invertedRate, provider: 'fawazahmed0', recorded_at: now });
    }
  }

  // Batch upsert rates
  for (const row of rateRows) {
    await db
      .insertInto('rates')
      .values(row)
      .onConflict((oc) =>
        oc.columns(['source', 'target']).doUpdateSet({
          rate: row.rate,
          provider: row.provider,
          updated_at: row.updated_at,
        })
      )
      .execute();
  }

  // Insert rate history
  if (historyRows.length > 0) {
    await db.insertInto('rate_history').values(historyRows).execute();
  }
}
```

---

## Task 6: Seed Middleware

**Files:**
- Create: `apps/api/src/middleware/seed.ts`

- [ ] **Step 1: Implement seed middleware**

```typescript
import { createMiddleware } from 'hono/factory';
import type { Env } from '../env';
import { createDb } from '../db/database';
import { fetchAndStoreRates } from '../services/rate-fetcher';

let seeded = false;

export const seedMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!seeded) {
    const db = createDb(c.env.DB);

    // Check both fiat and crypto exist
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
    }

    seeded = true;
  }

  await next();
});
```

---

## Task 7: API Routes

**Files:**
- Create: `apps/api/src/routes/currencies.ts`, `apps/api/src/routes/convert.ts`, `apps/api/src/routes/rates.ts`, `apps/api/src/routes/rate-history.ts`, `apps/api/src/routes/ws.ts`

- [ ] **Step 1: Create currencies route**

```typescript
// apps/api/src/routes/currencies.ts
import { Hono } from 'hono';
import type { Env } from '../env';
import { createDb } from '../db/database';

const currencies = new Hono<{ Bindings: Env }>();

currencies.get('/available_currencies', async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .selectFrom('currencies')
    .select(['code', 'name', 'type'])
    .orderBy('type')
    .orderBy('code')
    .execute();

  return c.json(rows);
});

export { currencies };
```

- [ ] **Step 2: Create convert route**

```typescript
// apps/api/src/routes/convert.ts
import { Hono } from 'hono';
import type { Env } from '../env';
import { createDb } from '../db/database';
import { ConvertRequestSchema, type ConvertResponse } from '../schemas';

const convert = new Hono<{ Bindings: Env }>();

async function findRate(db: ReturnType<typeof createDb>, source: string, target: string): Promise<number | null> {
  // Try direct
  const direct = await db
    .selectFrom('rates')
    .select('rate')
    .where('source', '=', source)
    .where('target', '=', target)
    .executeTakeFirst();
  if (direct) return direct.rate;

  // Try inverse
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

  // Same currency
  if (source === target) {
    const response: ConvertResponse = {
      source, target, amount, result: amount, rate: 1, via_usd: false,
      timestamp: new Date().toISOString(),
    };
    return c.json(response);
  }

  // Try direct rate (both directions)
  const directRate = await findRate(db, source, target);
  if (directRate !== null) {
    const response: ConvertResponse = {
      source, target, amount, result: amount * directRate, rate: directRate, via_usd: false,
      timestamp: new Date().toISOString(),
    };
    return c.json(response);
  }

  // Try via USD
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
```

- [ ] **Step 3: Create rates route**

```typescript
// apps/api/src/routes/rates.ts
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

    // Try direct
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

    // Try inverse
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
```

- [ ] **Step 4: Create rate-history route**

```typescript
// apps/api/src/routes/rate-history.ts
import { Hono } from 'hono';
import type { Env } from '../env';
import { createDb } from '../db/database';

const rateHistory = new Hono<{ Bindings: Env }>();

rateHistory.get('/rate_history', async (c) => {
  const source = c.req.query('source');
  const target = c.req.query('target');
  const limit = parseInt(c.req.query('limit') || '60', 10);

  const db = createDb(c.env.DB);

  let query = db
    .selectFrom('rate_history')
    .select(['source', 'target', 'rate', 'recorded_at'])
    .orderBy('recorded_at', 'desc')
    .limit(Math.min(limit, 200));

  if (source) query = query.where('source', '=', source);
  if (target) query = query.where('target', '=', target);

  const rows = await query.execute();
  return c.json(rows.reverse());
});

export { rateHistory };
```

- [ ] **Step 5: Create WebSocket route**

```typescript
// apps/api/src/routes/ws.ts
import { Hono } from 'hono';
import type { Env } from '../env';

const ws = new Hono<{ Bindings: Env }>();

ws.get('/ws', async (c) => {
  const id = c.env.RATE_TICKER.idFromName('global');
  const stub = c.env.RATE_TICKER.get(id);
  return stub.fetch(c.req.raw);
});

export { ws };
```

---

## Task 8: Durable Object — RateTicker

**Files:**
- Create: `apps/api/src/durable-objects/rate-ticker.ts`

- [ ] **Step 1: Implement RateTicker**

```typescript
import { DurableObject } from 'cloudflare:workers';

export class RateTicker extends DurableObject {
  private sessions: Set<WebSocket> = new Set();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal broadcast endpoint (called by scheduled handler)
    if (url.pathname === '/broadcast') {
      const data = await request.json();
      this.broadcast(JSON.stringify(data));
      return new Response('OK');
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    this.sessions.add(server);

    // Set heartbeat alarm
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (!currentAlarm) {
      await this.ctx.storage.setAlarm(Date.now() + 30000);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Handle pong or any client messages
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.sessions.delete(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    this.sessions.delete(ws);
  }

  async alarm(): Promise<void> {
    // Heartbeat: ping all connections
    for (const ws of this.sessions) {
      try {
        ws.send(JSON.stringify({ type: 'ping' }));
      } catch {
        this.sessions.delete(ws);
      }
    }
    // Re-schedule alarm
    if (this.sessions.size > 0) {
      await this.ctx.storage.setAlarm(Date.now() + 30000);
    }
  }

  private broadcast(message: string): void {
    for (const ws of this.sessions) {
      try {
        ws.send(message);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }
}
```

---

## Task 9: Worker Entry Point

**Files:**
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Create the main entry point**

```typescript
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

// Catch-all: delegate to ASSETS binding for static files / SPA fallback
app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    const db = createDb(env.DB);
    await fetchAndStoreRates(db);

    // Notify RateTicker DO to broadcast updated rates
    const id = env.RATE_TICKER.idFromName('global');
    const stub = env.RATE_TICKER.get(id);

    // Fetch all current rates
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
```

---

## Task 10: Frontend Scaffolding

**Files:**
- Create: `apps/frontend/package.json`, `apps/frontend/tsconfig.json`, `apps/frontend/vite.config.ts`, `apps/frontend/postcss.config.js`, `apps/frontend/index.html`, `apps/frontend/src/index.css`, `apps/frontend/src/vite-env.d.ts`, `apps/frontend/src/main.tsx`

- [ ] **Step 1: Create apps/frontend/package.json**

```json
{
  "name": "@currency-converter/frontend",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json, vite.config.ts, postcss.config.js**

tsconfig.json:
```json
{
  "extends": "../../packages/config/tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "./dist",
    "noEmit": true
  },
  "include": ["src"]
}
```

vite.config.ts:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

postcss.config.js:
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CurrencyX</title>
  </head>
  <body class="bg-gray-950 text-white min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create index.css, vite-env.d.ts, main.tsx**

index.css:
```css
@import 'tailwindcss';
```

vite-env.d.ts:
```typescript
/// <reference types="vite/client" />
```

main.tsx:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

## Task 11: Dollar Sign SVG Logo

**Files:**
- Create: `apps/frontend/src/assets/dollar-sign.svg`

- [ ] **Step 1: Create SVG asset**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="30" stroke="#10B981" stroke-width="3" fill="#064E3B"/>
  <text x="32" y="44" text-anchor="middle" font-size="36" font-weight="bold" fill="#10B981" font-family="sans-serif">$</text>
</svg>
```

---

## Task 12: Zustand Store

**Files:**
- Create: `apps/frontend/src/store/index.ts`

- [ ] **Step 1: Create the Zustand store**

```typescript
import { create } from 'zustand';

export type Currency = {
  code: string;
  name: string;
  type: 'fiat' | 'crypto';
};

export type ConversionResult = {
  source: string;
  target: string;
  amount: number;
  result: number;
  rate: number;
  via_usd: boolean;
  timestamp: string;
};

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

type RateEntry = {
  pair: string;
  rate: number;
  updated_at: string;
  previousRate?: number;
  history: number[];
};

interface AppState {
  currencies: Currency[];
  setCurrencies: (currencies: Currency[]) => void;

  rates: Record<string, RateEntry>;
  updateRates: (newRates: Array<{ pair: string; rate: number; updated_at: string }>) => void;

  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  conversionResult: ConversionResult | null;
  setConversionResult: (result: ConversionResult | null) => void;

  recentConversions: ConversionResult[];
  addConversion: (conversion: ConversionResult) => void;
  clearHistory: () => void;

  isConverting: boolean;
  setIsConverting: (v: boolean) => void;

  error: string | null;
  setError: (error: string | null) => void;
}

function loadConversions(): ConversionResult[] {
  try {
    const stored = sessionStorage.getItem('recentConversions');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveConversions(conversions: ConversionResult[]): void {
  sessionStorage.setItem('recentConversions', JSON.stringify(conversions));
}

export const useStore = create<AppState>((set, get) => ({
  currencies: [],
  setCurrencies: (currencies) => set({ currencies }),

  rates: {},
  updateRates: (newRates) =>
    set((state) => {
      const updated = { ...state.rates };
      for (const r of newRates) {
        const existing = updated[r.pair];
        const history = existing ? [...existing.history, r.rate].slice(-60) : [r.rate];
        updated[r.pair] = {
          pair: r.pair,
          rate: r.rate,
          updated_at: r.updated_at,
          previousRate: existing?.rate,
          history,
        };

        // Also store inverse
        const [source, target] = r.pair.split('/');
        if (source && target) {
          const inversePair = `${target}/${source}`;
          const inverseRate = 1 / r.rate;
          const existingInverse = updated[inversePair];
          const inverseHistory = existingInverse
            ? [...existingInverse.history, inverseRate].slice(-60)
            : [inverseRate];
          updated[inversePair] = {
            pair: inversePair,
            rate: inverseRate,
            updated_at: r.updated_at,
            previousRate: existingInverse?.rate,
            history: inverseHistory,
          };
        }
      }
      return { rates: updated };
    }),

  connectionStatus: 'disconnected',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  conversionResult: null,
  setConversionResult: (conversionResult) => set({ conversionResult }),

  recentConversions: loadConversions(),
  addConversion: (conversion) =>
    set((state) => {
      const updated = [conversion, ...state.recentConversions].slice(0, 10);
      saveConversions(updated);
      return { recentConversions: updated };
    }),
  clearHistory: () => {
    sessionStorage.removeItem('recentConversions');
    set({ recentConversions: [] });
  },

  isConverting: false,
  setIsConverting: (isConverting) => set({ isConverting }),

  error: null,
  setError: (error) => set({ error }),
}));
```

---

## Task 13: Frontend Components

**Files:**
- Create: all component files in `apps/frontend/src/components/`

- [ ] **Step 1: Create Header.tsx**
- [ ] **Step 2: Create Sparkline.tsx (Canvas 2D)**
- [ ] **Step 3: Create RateCard.tsx**
- [ ] **Step 4: Create RateDashboard.tsx**
- [ ] **Step 5: Create CurrencyDropdown.tsx**
- [ ] **Step 6: Create ResultDisplay.tsx**
- [ ] **Step 7: Create Converter.tsx**
- [ ] **Step 8: Create RecentConversions.tsx**
- [ ] **Step 9: Create App.tsx with WebSocket integration**

(Full component code provided in implementation — see execution phase)

---

## Task 14: Dev Scripts + Report

**Files:**
- Modify: root `package.json`
- Create: `report.json`

- [ ] **Step 1: Add dev script to root package.json**

```json
{
  "scripts": {
    "dev": "bun run --filter @currency-converter/frontend build && cp -r apps/frontend/dist apps/api/public && bun run --filter @currency-converter/api dev"
  }
}
```

- [ ] **Step 2: Create report.json**

```json
{
  "model": "opus-4.6",
  "time_taken_minutes": "<filled at end>"
}
```

---

## Task 15: Install Dependencies + Verify Build

- [ ] **Step 1: Run bun install from root**
- [ ] **Step 2: Build frontend**
- [ ] **Step 3: TypeScript check**
- [ ] **Step 4: Update report.json with final time**
