# PDR 003: Frontend State And Live Updates

## Status
Accepted

## Context

The UI needs immediate current rates, live WebSocket updates, sparkline history, persisted recent conversions, and explicit connection state.

## Decision

- Use a single Zustand store for currencies, conversion state, dashboard rates, sparkline series, and WebSocket status
- Persist recent conversions to `sessionStorage` with Zustand persistence
- When any rate enters the store, also compute and store the inverse direction
- Fetch currency metadata first, then current rates, then open the WebSocket connection
- Backfill sparkline history from `/api/rate_history` after the initial rate fetch

## Consequences

- Dashboard cards remain resolvable even when the backend broadcasts storage-direction pairs.
- The app stays usable after refreshes within the same browser session.
- Live and initial data flows share a single state update path.

