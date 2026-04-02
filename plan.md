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
There is a single currency provider for both FIAT and crypto:
- **fawazahmed0/exchange-api** — a free, no-auth API hosted on Cloudflare Pages.
  - **Rates endpoint:** `https://latest.currency-api.pages.dev/v1/currencies/usd.json` — returns all rates relative to USD in a single call. Response shape: `{ "date": "...", "usd": { "eur": 0.86, "btc": 0.000015, ... } }`. Codes are **lowercase** — must be uppercased. The response contains hundreds of currencies (fiat + crypto + obscure tokens); filter to only the currencies you need (known fiat codes + BTC, ETH, SOL, XRP).
  - **Currency names endpoint:** `https://latest.currency-api.pages.dev/v1/currencies.json` — returns `{ "eur": "Euro", "btc": "Bitcoin", ... }`. Fetch alongside rates to populate currency names in the DB.
  - Fiat rates are stored as `USD → X` (e.g., source=USD, target=EUR, rate=0.86). Crypto rates must be inverted: the API returns `usd → btc = 0.000015` (meaning 1 USD = 0.000015 BTC), but we need `BTC → USD`, so store as `source=BTC, target=USD, rate=1/0.000015`.
  - Free, no auth, no rate limit concerns.

**NOTE — Do NOT use CoinGecko or ExchangeRate-API.** CoinGecko's free tier is unreliable from Cloudflare Workers. ExchangeRate-API does not return currency names. fawazahmed0/exchange-api provides both rates and names for all currencies in a single source.

**IMPORTANT — Seed middleware must check both types:**
The initial seed middleware must verify that BOTH fiat AND crypto currencies exist in the DB before skipping. If only fiat was seeded (e.g., fetch partially failed), the middleware must re-run the scheduled handler to fill in the missing data. Check `WHERE type = 'fiat'` and `WHERE type = 'crypto'` separately.

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
| Static Assets | `ASSETS` | Access via `env.ASSETS.fetch()` — used in catch-all route to serve SPA |

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

Do not use `[site]` — it is legacy Workers Sites. Use `[assets]` which is the current Cloudflare Workers static assets system.

**CRITICAL: Because `run_worker_first = true` is set, the Worker receives EVERY request first — including requests for static assets like `/index.html`, `/assets/main.js`, etc.** The Worker MUST have a catch-all route at the end that delegates to the `ASSETS` binding:

```typescript
// After all /api/* and /ws routes:
app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});
```

Without this catch-all, Hono's default 404 response will prevent the `[assets]` layer from serving static files and the SPA will be broken. The `ASSETS` binding handles SPA fallback (`not_found_handling = "single-page-application"`), so unknown paths correctly serve `index.html`.

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
4. `GET /api/rates?pairs=BTC/USD,EUR/USD,...` — returns current rates for specific pairs. Accepts a `pairs` query parameter (comma-separated). For each requested pair, the API looks up the direct rate first; if not found, tries the inverse direction and returns `1/rate`. This handles the direction mismatch where fiat rates are stored as `USD/EUR` but the dashboard needs `EUR/USD`. **Do NOT return all rates** — only the requested pairs. The frontend passes the dashboard widget pairs.
5. `GET /ws` — upgrades to WebSocket connection via Durable Object for live rate ticker

### Rate Fetching — Cron Triggers

Rates are fetched using Cloudflare **Cron Triggers** (configured in `wrangler.toml`):
- Runs every minute
- Fetches rates and currency names from fawazahmed0 API using native `fetch`
- Writes new rates to D1
- Stores historical snapshots in `rate_history` table
- After writing, notifies the `RateTicker` Durable Object to broadcast updates to all connected WebSocket clients

**IMPORTANT — Initial Seed on First Request:**
The cron trigger does not fire immediately on deploy or on `wrangler dev` startup. The Worker **must** include a middleware on `/api/*` routes that checks if the `currencies` table is empty on the first request, and if so, runs the scheduled rate-fetch handler inline before proceeding. This ensures the app is usable immediately without waiting for the first cron tick. Use a module-level flag (e.g., `let seeded = false`) so the check only runs once.

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
| provider | TEXT | "fawazahmed0" |

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

1. Look up direct rate for `(source, target)` — **try both directions**: if `(source, target)` is not found, try `(target, source)` and use `1/rate`
2. If found: `result = amount * rate` (`via_usd: false`)
3. If not found, try via USD — look up `(source, USD)` and `(USD, target)`, **each leg trying both directions**:
   - `result = amount * source_to_usd_rate * usd_to_target_rate` (`via_usd: true`)
4. If neither path exists, return an error

**IMPORTANT — Bidirectional rate lookup is required.** Every rate lookup must try both `(A, B)` and `(B, A)` directions. This is because:
- Fiat rates are stored as `USD → X` (e.g., `source=USD, target=EUR`)
- Crypto rates are stored as `X → USD` (e.g., `source=BTC, target=USD`)
- Converting USD → ETH requires finding `ETH → USD` and inverting it
- Converting BTC → EUR requires `BTC → USD` (direct) then `USD → EUR` (direct) — both exist but in different directions

Without bidirectional lookup, cross-type conversions (fiat ↔ crypto) will fail with "No conversion path found".

**Rate storage convention:** The fawazahmed0 API returns all rates as `1 USD = X target` (e.g., `"eur": 0.86` means 1 USD = 0.86 EUR). For fiat, store directly as `source=USD, target=X, rate=X`. For crypto, the API returns `"btc": 0.000015` (1 USD = 0.000015 BTC) — invert this and store as `source=BTC, target=USD, rate=1/0.000015 ≈ 66667`. USD acts as the universal bridge between fiat and crypto.

**IMPORTANT — Rate direction mismatch on the frontend:**
The rate dashboard displays fixed pairs like `EUR/USD`, `GBP/USD`, but fiat rates are stored in the DB as `source=USD, target=EUR` (i.e., key `USD/EUR`). The frontend Zustand store **must** compute and store inverse rates for every rate update: when receiving `USD/EUR = 0.92`, also store `EUR/USD = 1/0.92 ≈ 1.087`. This ensures dashboard pairs always resolve regardless of which direction the rate was originally stored. Apply this to both the initial `/api/rates` fetch and incoming WebSocket updates.

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
1. Fetches available currencies via `GET /api/available_currencies` — **this must complete first** because it triggers the initial DB seed on fresh deploys (see "Initial Seed on First Request" in the backend section)
2. Fetches current rates via `GET /api/rates` — **must happen after step 1** to ensure rates exist in the DB; populates the rate dashboard immediately
3. Opens a WebSocket connection to `/ws` for live rate updates

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
│  │  [====USD ▾====]  [⇅]  [====EUR ▾====] [1000] [Go]│  │
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
- **Converter section**: two custom Tailwind-styled dropdowns (source/target) — do NOT use native `<select>` elements. Build a custom `<CurrencyDropdown />` component with: a trigger button showing the selected currency, a chevron icon that rotates when open, a search/filter input at the top of the dropdown panel, a scrollable list of currencies with hover and active states, click-outside to close. All styled with Tailwind utility classes (dark theme: `bg-gray-800`, `border-gray-700`, etc.). The two dropdowns must **stretch equally (`flex-1`) to fill the available container width**; the swap button, amount input, and convert button remain fixed-width. Between the two dropdowns, a **swap button** (with a horizontal bi-directional arrows SVG icon) that swaps source and target currencies on click. Amount input and convert button.
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

- `bun run dev` in `apps/api` — applies D1 migrations locally (`wrangler d1 migrations apply <db-name> --local`), then runs `wrangler dev` which uses Miniflare to emulate Workers + D1 + DO locally. The local D1 database is backed by SQLite stored under `.wrangler/`.
- `bun run dev` in `apps/frontend` — runs Vite dev server with proxy to API
- The root `models/<model-name>/package.json` **must** have a `"dev"` script so the entire app can be started locally with `bun dev` from the model directory. This script should: (1) build the frontend, (2) copy `apps/frontend/dist/` to `apps/api/public/`, (3) run the API dev server (which applies migrations and starts `wrangler dev`).
- The `apps/api/package.json` `"dev"` script **must** apply D1 migrations before starting: `wrangler d1 migrations apply <db-name> --local && wrangler dev`

### Report

After implementation is complete, the model **must** create a `report.json` file in the model root directory (`models/<model-name>/report.json`) with the following structure:

```json
{
  "model": "<model-identifier>",
  "time_taken_minutes": "<number>"
}
```

- `model`: The model identifier used (e.g., `"opus-4.6"`, `"sonnet-4.6"`)
- `time_taken_minutes`: How many minutes the implementation took, as a string
