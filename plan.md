# Currency Converter App

## App Description

A currency conversion app with both FIAT and Crypto support. It fetches currency rates from publicly available APIs, stores them in a D1 database, and pushes live rate updates to connected clients via WebSocket (Durable Objects).

The UI is a React SPA with:

1. Source currency dropdown
2. Target currency dropdown
3. Amount input field
4. `Convert` button
5. Live rate ticker showing real-time price updates via WebSocket

There is also a table of the 10 most recent conversions performed by the user.

Recent conversions are persisted in `sessionStorage` (browser API) and synced with a Zustand store. A `Clear` button clears both the Zustand store and `sessionStorage`.

**IMPORTANT!**
Conversion can be done between any pairs. If the direct rate is not found, the intermediate rate is `USD`. When a conversion uses USD as an intermediary, the API response and UI should indicate this (e.g., "Converted via USD").

**IMPORTANT!**
There are two currency providers:
- **FIAT**: ExchangeRate-API — endpoint: `https://open.er-api.com/v6/latest/USD`. Returns all fiat rates relative to USD in a single call. Free, no auth, no rate limit concerns at 1 call/minute.
- **Crypto**: CoinGecko API — endpoint: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple&vs_currencies=usd`. Returns crypto prices in USD. **Free tier is rate-limited to ~10-30 calls/minute.** Fetch all needed coins in a single call using comma-separated IDs. Do NOT make one request per coin. Implement retry with exponential backoff on 429 responses.

## General Architecture

**Deployment target**: Cloudflare (Workers + D1 + Durable Objects)

Both apps are stored in a monorepo using **Bun workspaces**:
- `apps/api` — Hono API on Cloudflare Workers (also serves the built frontend)
- `apps/frontend` — React SPA (built by Vite, output copied into Worker for serving)
- `packages/config` — shared tsconfig + eslint config

Applications are written in TypeScript using strict mode. Applications have ESLint enabled. Tsconfig and ESLint configuration are shared between apps and placed in `packages/config` folder. Applications can override the base `tsconfig.json` and ESLint config.

### Runtime Warning: Bun vs Cloudflare Workers

This app is developed and tested locally using **Bun**, but runs in production on **Cloudflare Workers** (V8 isolate — NOT Bun, NOT Node.js). Code **must** be compatible with the Workers runtime:

- **DO NOT** use Bun-specific APIs: `Bun.serve`, `Bun.file`, `Bun.write`, `Bun.env`, `Bun.sleep`, etc.
- **DO NOT** use Node.js built-in modules (`fs`, `path`, `http`, `net`, etc.) unless behind `nodejs_compat`
- **DO** use Web Standard APIs: `fetch`, `Request`, `Response`, `URL`, `crypto.subtle`, `TextEncoder`, etc.
- **DO** use Hono's platform-agnostic APIs for request/response handling
- Code that works with `bun run` locally may fail silently on Workers if it uses Bun-specific APIs

### Deployment Conventions (MUST follow)

This app will be deployed by an automated pipeline that generates `wrangler.toml` and wires up Cloudflare resources. The code **must** follow these conventions for deployment to work:

#### File Structure (required paths)

| Path | Purpose |
|------|---------|
| `apps/api/src/index.ts` | Worker entry point — must be the default export |
| `apps/api/src/durable-objects/rate-ticker.ts` | Durable Object class, must export `RateTicker` |
| `apps/api/migrations/` | Wrangler D1 SQL migration files (`.sql` format, not Kysely JS migrations) |
| `apps/frontend/dist/` | Vite build output (default, don't change) |

#### Required `package.json` Scripts

The CI pipeline runs specific commands. These scripts **must** exist:

| Package | Script | Command |
|---------|--------|---------|
| `apps/frontend/package.json` | `build` | Must run Vite build, outputting to `dist/` |
| `apps/api/package.json` | `dev` | Local dev server (optional, for local testing) |
| Root `package.json` | — | Must define Bun workspaces: `"workspaces": ["apps/*", "packages/*"]` |

#### API Route Prefix

All backend endpoints **must** be under `/api/`:

| Endpoint | Note |
|----------|------|
| `GET /api/available_currencies` | Not `/available_currencies` |
| `POST /api/convert` | Not `/convert` |
| `GET /api/rate_history` | Not `/rate_history` |
| `GET /ws` | Exception — WebSocket upgrade stays at root |

#### Frontend API Calls

The frontend **must** use relative URLs for all API calls. Never hardcode a host or port:

```typescript
// CORRECT
fetch('/api/convert', { ... })
new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`)

// WRONG — will break in production
fetch('http://localhost:3000/convert', { ... })
```

#### Cloudflare Bindings (fixed names)

The deploy pipeline generates `wrangler.toml` with these binding names. Code **must** use these exact names:

| Binding | Name | Description |
|---------|------|-------------|
| D1 Database | `DB` | Access via `env.DB` in Hono context |
| Durable Object | `RATE_TICKER` | Access via `env.RATE_TICKER`, class name must be `RateTicker` |

#### Worker Entry Point Shape

`apps/api/src/index.ts` must export a Workers-compatible object with `fetch` and `scheduled` handlers, plus the Durable Object class:

```typescript
import { RateTicker } from './durable-objects/rate-ticker';

// Re-export Durable Object class (required for DO binding)
export { RateTicker };

// Default export MUST include both fetch and scheduled handlers.
// Just `export default app` will NOT work — cron triggers need a `scheduled` handler.
export default {
  fetch: app.fetch,        // Hono handles HTTP requests
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    // Rate fetching logic — called by Cron Triggers every minute
  },
};
```

**WARNING:** `export default app` (bare Hono app) only provides a `fetch` handler. The `scheduled` handler will be missing and cron triggers will silently fail — rates will never update. You MUST use the object export shape above.

#### Static Asset Serving

The deploy pipeline copies `apps/frontend/dist/` into `apps/api/public/` and configures `[assets]` in wrangler.toml (NOT the legacy `[site]`). The `[assets]` config uses:
- `not_found_handling = "single-page-application"` — SPA fallback for client-side routes
- `run_worker_first = true` — ALL requests hit the Worker first, then fall through to static assets if the Worker doesn't return a response

The Worker does **not** need to serve static files manually. Do not use `[site]` — it is legacy Workers Sites. Use `[assets]` which is the current Cloudflare Workers static assets system.

**CRITICAL: Because `run_worker_first = true` is set, the Worker receives EVERY request first — including requests for static assets like `/index.html`, `/assets/main.js`, etc.** The Worker MUST only handle `/api/*` and `/ws` routes. It MUST NOT have:
- A catch-all route (e.g., `app.get('*', ...)`)
- A fallback middleware that returns a response for unknown routes
- A custom 404 handler that sends a response body

If the Worker returns ANY response for non-API routes, the static assets layer will never serve those files and the SPA will be broken. Unmatched routes must fall through (return nothing) so the `[assets]` layer can serve them.

For **local development**, the Hono app should serve static files from `../frontend/dist/` or use Vite's proxy. This is optional — the deploy pipeline does not depend on it.

## Backend

### Stack

| Library | Purpose |
|---------|---------|
| Hono | Web framework (Workers-native) |
| Kysely + kysely-d1 | Type-safe query builder with D1 dialect |
| Zod | Payload and API response validation |
| @cloudflare/workers-types | Worker type definitions |
| Bun | Local runtime + test runner |

### Endpoints

1. `GET /api/available_currencies` — returns all available currencies (FIAT and crypto)
2. `POST /api/convert` — converts an amount between two currencies; response includes `via_usd: boolean` indicator
3. `GET /api/rate_history` — returns historical exchange rate data (time series of rate snapshots from the `rate_history` table). This is NOT user conversion history — user conversions are stored client-side in `sessionStorage` only.
4. `GET /ws` — upgrades to WebSocket connection via Durable Object for live rate ticker

### Rate Fetching — Cron Triggers

Rates are fetched using Cloudflare **Cron Triggers** (configured in `wrangler.toml`):
- Runs every minute
- Fetches from both providers using native `fetch`
- Writes new rates to D1
- Stores historical snapshots in `rate_history` table
- After writing, notifies the `RateTicker` Durable Object to broadcast updates to all connected WebSocket clients

### Durable Object — `RateTicker`

A stateful edge singleton that manages live WebSocket connections:

- **WebSocket upgrade**: Clients connect via `/ws`, request is routed to the Durable Object
- **Connection management**: Tracks all active WebSocket connections
- **Rate broadcasting**: When notified by the Cron Trigger (via internal `fetch` to the DO), broadcasts new rates to all connected clients
- **Heartbeat**: Uses the Durable Object Alarm API (`this.ctx.storage.setAlarm()`) for periodic keepalive pings. The DO has SQLite-backed storage but only needs the alarm feature — no persistent state storage required
- **Lifecycle**: Handles open/close/error events, cleans up stale connections

### Database — D1 + Kysely

- **D1** (Cloudflare's serverless SQLite) as the production database
- **Kysely** with `kysely-d1` dialect adapter for type-safe queries
- **Migrations** are plain `.sql` files in `apps/api/migrations/`, managed via `wrangler d1 migrations` commands (NOT Kysely JS migrations). Kysely is used only as a query builder at runtime, not for schema management
- **Kysely type definitions** must match the SQL migration schema exactly. Define a `Database` interface (e.g., in `apps/api/src/db/types.ts`) that mirrors the tables created by your `.sql` migrations. If you add a column in a migration, update the Kysely types too — TypeScript won't catch the mismatch at compile time

#### Tables

**`currencies`**
| Column | Type | Description |
|--------|------|-------------|
| code | TEXT PK | Currency code (USD, BTC, etc.) |
| name | TEXT | Full name |
| type | TEXT | "fiat" or "crypto" |
| provider | TEXT | "exchangerate-api" or "coingecko" |

**`rates`** (current rates — one row per currency pair, UPSERTed on each fetch)
| Column | Type | Description |
|--------|------|-------------|
| source | TEXT | Source currency code |
| target | TEXT | Target currency code |
| rate | REAL | Exchange rate: "1 source = rate target" (e.g., source=USD, target=EUR, rate=0.92 means 1 USD = 0.92 EUR) |
| provider | TEXT | Which provider supplied this rate |
| updated_at | TEXT | ISO timestamp of last update |
| | | **UNIQUE(source, target)** — use UPSERT (INSERT ... ON CONFLICT UPDATE) when writing new rates |

**`rate_history`**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| source | TEXT | Source currency code |
| target | TEXT | Target currency code |
| rate | REAL | Exchange rate |
| provider | TEXT | Which provider supplied this rate |
| recorded_at | TEXT | ISO timestamp |

### Conversion Logic

All rates in the `rates` table are stored as **"1 source = rate target"** (forward direction). Conversion math always uses this convention:

1. Look up direct rate for `(source, target)` in `rates` table
2. If found: `result = amount * rate` (`via_usd: false`)
3. If not found, look up `(source, USD)` and `(USD, target)`:
   - `result = amount * source_to_usd_rate * usd_to_target_rate` (`via_usd: true`)
4. If neither path exists, return an error

**Rate storage convention:** When fetching from providers, normalize all rates to forward direction. ExchangeRate-API returns all rates relative to a base (e.g., base=USD gives "1 USD = X target"), so store as `source=USD, target=X, rate=X`. CoinGecko returns prices in USD (e.g., BTC price = 67432 USD), so store as `source=BTC, target=USD, rate=67432`.

### Validation

- All API request payloads validated using **Zod** with a custom Hono middleware (replaces NestJS validation pipe)
- Currency rate API responses from external providers also validated with Zod schemas
- DTOs defined as Zod schemas with inferred TypeScript types

### Error Handling

- API returns appropriate error responses when rates haven't been loaded yet
- Conversion endpoint returns clear errors for unknown currencies or missing rates
- External API failures are caught and logged; stale rates remain available

### Testing

- **Bun test** (`bun test`) as the test runner (Jest-compatible API)
- Unit tests for conversion logic, validation, and provider parsing
- Integration tests using **Miniflare** for D1 simulation
- In-memory D1 database for test isolation

## Frontend

### Stack

| Library | Purpose |
|---------|---------|
| React | UI framework |
| Vite | Build tool |
| Tailwind (latest) | Styling |
| Zustand | State management |

### UI

Frontend is a SPA, no routing required. On startup it:
1. Fetches available currencies via `GET /api/available_currencies`
2. Opens a WebSocket connection to `/ws` for live rate updates

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│  [$] CurrencyX                        ● Connected       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ BTC/USD  │ │ ETH/USD  │ │ EUR/USD  │                 │
│  │ $67,432  │ │ $3,201   │ │ $1.0842  │                 │
│  │ ▲ +2.3%  │ │ ▼ -0.8%  │ │ ▲ +0.1%  │                 │
│  │ ≋canvas≋ │ │ ≋canvas≋ │ │ ≋canvas≋ │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ GBP/USD  │ │ SOL/USD  │ │ XRP/USD  │                 │
│  │ $1.2731  │ │ $142.50  │ │ $0.5234  │                 │
│  │ ▲ +0.2%  │ │ ▼ -1.5%  │ │ ▲ +3.1%  │                 │
│  │ ≋canvas≋ │ │ ≋canvas≋ │ │ ≋canvas≋ │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [USD ▾]  →  [EUR ▾]     [  1000  ]  [ Convert ]  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Result: 1000 USD = 1,084.20 EUR                         │
│  ⓘ Converted via USD                                     │
│                                                          │
│  Recent Conversions                    [ Clear history ] │
│  ┌────────┬────────┬──────────┬───────────┬───────────┐  │
│  │ From   │ To     │ Amount   │ Result    │ Via USD?  │  │
│  ├────────┼────────┼──────────┼───────────┼───────────┤  │
│  │ BTC    │ EUR    │ 0.5      │ €33,716   │ Yes       │  │
│  │ USD    │ GBP    │ 500      │ £392.80   │ No        │  │
│  │ ...    │ ...    │ ...      │ ...       │ ...       │  │
│  └────────┴────────┴──────────┴───────────┴───────────┘  │
└──────────────────────────────────────────────────────────┘
```

#### Components

- **Header bar**: spinning dollar SVG logo, app name, WebSocket connection status indicator (green dot = connected, yellow = reconnecting, red = disconnected)
- **Rate dashboard**: 2x3 grid of cards for fixed top 6 pairs (BTC/USD, ETH/USD, EUR/USD, GBP/USD, SOL/USD, XRP/USD). Each card shows:
  - Currency pair label
  - Current rate value
  - % change since last update (green up arrow / red down arrow)
  - Canvas 2D sparkline showing rate history (last ~60 data points from WebSocket updates)
  - Flash animation on rate change (brief green/red background pulse)
- **Converter section**: two dropdowns (source/target), amount input, convert button
- **Result display**: shows converted amount, "Converted via USD" indicator when applicable
- **Recent conversions table**: 10 most recent, with From/To/Amount/Result/Via USD columns
- **"Clear history" button**: clears Zustand store + sessionStorage
- Error states for when rates aren't loaded or conversion fails

#### Canvas Sparkline Component

A reusable `<Sparkline />` component that:
- Accepts an array of rate data points
- Renders on an HTML5 Canvas 2D context
- Draws a smooth line (using quadratic bezier curves for smoothing)
- Colors the line green if the trend is up, red if down
- Optionally fills the area under the curve with a gradient
- Handles resize via ResizeObserver
- Uses `requestAnimationFrame` for smooth updates when new data arrives via WebSocket

### State Management

- Zustand store for all app state (currencies, conversion result, recent conversions, WebSocket connection status)
- Recent conversions synced with browser `sessionStorage`
- "Clear history" clears both Zustand store and `sessionStorage`

### WebSocket Integration

- Connect to `/ws` on app mount
- Receive rate update messages, update Zustand store
- Show connection status indicator (connected/reconnecting/disconnected)
- Auto-reconnect with exponential backoff

### Logo

A spinning dollar sign using SVG. The SVG file must be a separate asset file (NOT inlined). Vite is configured to serve SVG assets as files rather than inlining them.

### Dev Server

Vite dev server configured with a proxy to the Hono backend (running locally via `bun run`) to avoid CORS issues during development.

## Deployment

### Cloudflare Configuration (`wrangler.toml`)

- **Workers**: API deployed as a Cloudflare Worker
- **D1**: Database binding for the worker
- **Durable Objects**: `RateTicker` class binding (SQLite-backed via `new_sqlite_classes`)
- **Cron Triggers**: `*/1 * * * *` (every minute)
- **Static Assets**: Frontend built by Vite, served by the Worker via `[assets]` config (NOT Cloudflare Pages)
- **Compatibility**: `compatibility_flags = ["nodejs_compat"]` enabled for Node.js polyfills if needed

### Local Development

- `bun run dev` in `apps/api` — runs Hono with Miniflare (simulates Workers + D1 + DO locally)
- `bun run dev` in `apps/frontend` — runs Vite dev server with proxy to API
