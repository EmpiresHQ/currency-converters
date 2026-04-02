# PDR 001: Monorepo Shape And Runtime Boundaries

## Status
Accepted

## Context

The implementation must follow the deployment contract in `plan.md` without consulting existing model implementations. The app runs locally with Bun but deploys to Cloudflare Workers, D1, and Durable Objects.

## Decision

Use a Bun workspace monorepo rooted at `models/gpt-5.4-codex/` with:

- `apps/api` for the Hono Worker, D1 migrations, and Durable Object
- `apps/frontend` for the Vite + React SPA
- `packages/config` for shared TypeScript and ESLint configuration

The Worker entry point exports a default object with both `fetch` and `scheduled`, plus a named `RateTicker` Durable Object export. Static assets are served through the `ASSETS` binding with a catch-all route.

## Consequences

- Local and deployed runtime behavior stays aligned with the Cloudflare execution model.
- The project is self-contained inside the target model directory.
- Backend and frontend can share conventions without sharing runtime code.

