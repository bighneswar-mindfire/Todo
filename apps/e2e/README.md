# @todo/e2e

Playwright journey for FR-E2E-1 (AB-1016). It starts the real API and the Vite dev server, so it exercises the browser, the `/api` proxy, the backend and PostgreSQL together.

## Prerequisites

- `docker compose up -d` (Postgres 16 on `localhost:5432`).
- `pnpm install`, then once: `pnpm --filter @todo/e2e exec playwright install chromium`.
- Port **3000** (API, fixed by the frontend proxy) and **5180** (web) must be free. Stop any local `pnpm --filter @todo/backend dev`, including its `tsx watch` parent, because the suite never reuses a running server.

## Run

- `pnpm test:e2e` from the repo root runs the browser suite headless.
- `pnpm test` runs only the fast config tests of this package, not the browser.

The run uses its own database `todo_e2e` (created and migrated by `src/prepare-db.ts` when the API starts); the development database is untouched. Each run registers a new user, so no cleanup is needed. To start from an empty E2E database, delete `todo_e2e` with `psql` against the `postgres` database; it is recreated on the next run.

Failures keep a trace and screenshot in `test-results/` (`pnpm exec playwright show-trace <trace.zip>`).

## Layout

- `tests/journey.spec.ts`: one serial journey, one test per step, titled like the spec scenarios.
- `tests/guards.spec.ts`: unauthenticated redirect and invalid registration.
- `src/`: constants, `uniqueEmail()`, database preparation and the config tests.
