# Plan-Driven Requirements (PDR)
## Currency Converter App Implementation

### PDR-001: Project Structure
**Requirement:** Monorepo with Bun workspaces
**Structure:**
```
models/kimi-2.5-opencode-go-omo-slim/
├── apps/
│   ├── api/           # Hono API on Cloudflare Workers
│   └── frontend/      # React SPA with Vite
├── packages/
│   └── config/        # Shared tsconfig + eslint
├── package.json       # Root with workspaces
└── report.json        # Final report
```

### PDR-002: Database Schema (D1)
**Tables:**
1. `currencies` - code (PK), name, type (fiat/crypto), provider
2. `rates` - source, target, rate, provider, updated_at, UNIQUE(source, target)
3. `rate_history` - id (PK), source, target, rate, provider, recorded_at

### PDR-003: API Endpoints (all under /api/)
1. `GET /api/available_currencies` - List all currencies
2. `POST /api/convert` - Convert amount, returns via_usd flag
3. `GET /api/rate_history` - Time series data
4. `GET /api/rates?pairs=...` - Current rates for specific pairs
5. `GET /ws` - WebSocket upgrade (root level, not /api/)

### PDR-004: Rate Fetching Logic
**Provider:** fawazahmed0/exchange-api
**Endpoints:**
- Rates: `https://latest.currency-api.pages.dev/v1/currencies/usd.json`
- Names: `https://latest.currency-api.pages.dev/v1/currencies.json`

**Storage Convention:**
- Fiat: Store as USD→X (direct from API)
- Crypto: Invert API rate (X→USD) - API gives USD→BTC, we store BTC→USD

**Cron:** Every minute via Cloudflare Cron Triggers
**Seed:** Middleware checks empty DB on first request, triggers seed

### PDR-005: Conversion Logic
1. Try direct rate (source, target)
2. Try inverse (target, source) → use 1/rate
3. If no direct, try via USD (both legs, bidirectional)
4. Return via_usd: true/false indicator

### PDR-006: Durable Object (RateTicker)
- WebSocket connection management
- Broadcast rate updates to all clients
- Heartbeat via Alarm API
- SQLite-backed storage (alarms only)

### PDR-007: Frontend Components
1. **Header:** Logo (spinning dollar SVG), connection status indicator
2. **Rate Dashboard:** 2x3 grid, 6 cards (BTC/USD, ETH/USD, EUR/USD, GBP/USD, SOL/USD, XRP/USD)
   - Rate value, % change, canvas sparkline, flash animation
3. **Converter:**
   - Custom dropdowns (NOT native select), search/filter, swap button
   - Amount input, Convert button
   - Result display with "via USD" indicator
4. **Recent Conversions Table:** 10 rows, Clear button

### PDR-008: Frontend State (Zustand)
- Currencies list
- Current rates (with inverse computed)
- Conversion result
- Recent conversions (synced to sessionStorage)
- WebSocket connection status

### PDR-009: WebSocket Integration
- Connect on mount to /ws
- Auto-reconnect with exponential backoff
- Rate updates update Zustand store
- Status indicator (green/yellow/red)

### PDR-010: Deployment Conventions
**Required paths:**
- `apps/api/src/index.ts` - Worker entry, default export with fetch+scheduled
- `apps/api/src/durable-objects/rate-ticker.ts` - RateTicker DO class
- `apps/api/migrations/*.sql` - D1 migrations
- `apps/frontend/dist/` - Vite output

**Bindings:**
- D1: `DB`
- DO: `RATE_TICKER`
- Assets: `ASSETS`

**Scripts:**
- Root: workspaces defined
- Frontend: `build` script
- API: `dev` script (migrations + wrangler dev)

### PDR-011: Canvas Sparkline Component
- HTML5 Canvas 2D
- Smooth line (quadratic bezier)
- Green/red color based on trend
- Gradient fill under curve
- ResizeObserver for responsive
- requestAnimationFrame for updates

### PDR-012: Validation & Error Handling
- Zod for API payloads and external API responses
- Custom Hono middleware for validation
- Clear errors for missing rates/unknown currencies
- Stale rates remain available on external API failure

### PDR-013: Testing
- Bun test runner
- Unit tests for conversion logic
- Integration tests with Miniflare

### PDR-014: Local Development
- API: `wrangler d1 migrations apply --local && wrangler dev`
- Frontend: Vite dev server with proxy
- Root dev script: build frontend, copy to public/, run API

### PDR-015: Report
- File: `report.json` in model root
- Fields: model identifier, time_taken_minutes
