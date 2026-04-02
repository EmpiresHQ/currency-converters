# PDR 002: Rate Storage, Lookup, And Seeding

## Status
Accepted

## Context

The provider returns `USD -> X` rates for both fiat and crypto, while the app must support conversions between any supported currencies and expose fiat dashboard pairs like `EUR/USD`.

## Decision

- Store fiat rates as `USD -> X`
- Store crypto rates as `X -> USD` by inverting the provider payload
- Resolve every lookup bidirectionally: `(A, B)` first, then `(B, A)` and invert
- Fall back to `USD` as the single intermediary for conversions
- Seed the database lazily on the first `/api/*` request and re-run the seed if either fiat or crypto rows are missing

## Consequences

- Cross-type conversions work without needing every possible pair in the database.
- The frontend can request dashboard pairs independently of storage direction.
- Partial seed failures recover automatically on the first API request.

