## Context

See proposal.md (Why). Current state: the frontend is a Vite SPA that proxies `/api/*` to `http://localhost:3000` (`apps/frontend/src/config/api-proxy.ts`, port fixed there); the backend (`createApp`, `server.ts`) reads `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET` (min 32 chars) through the shared `parseEnv`, and loads `.env` via `dotenv` (real environment variables win over `.env`). Postgres 16 runs from `docker-compose.yml` (user, password and database `todo`). The password-reset OTP is console-logged and not part of this journey. No Playwright exists yet.

## Goals / Non-Goals

**Goals**
- One command (`pnpm test:e2e`) that boots everything, runs the journey and tears down.
- No dependence on, or damage to, the developer's data.
- Stable tests: web-first assertions, role/label locators, no fixed sleeps.

**Non-Goals**
- CI wiring, browsers other than Chromium, production code changes, new shared types or schemas (nothing here defines an API type).

## Decisions

1. **New workspace package `apps/e2e` (`@todo/e2e`)**, not tests inside `apps/frontend`. The suite spans both apps and must not be picked up by the frontend's jsdom Vitest `include` or its coverage thresholds. The existing `apps/*` workspace glob covers it. Alternative: `e2e/` at the repo root, rejected because it would sit outside the workspace graph and pnpm's pinning/lockfile flow.

2. **Journey shape: one `test.describe.serial` with one test per step**, sharing a signed-in `BrowserContext` created in `beforeAll`. This matches "every scenario has exactly one named test" and makes a failure point at a step. Trade-off: a failed step skips later ones; acceptable because the steps are genuinely dependent. Alternatives rejected: a single long test (vague failures, scenarios would be `test.step`s) and independent API-seeded tests (not one journey, FR-E2E-1 reads as one).
   - The first two steps use their own pages: "Register" registers and lands on `/`; "Log in" logs out and logs in again, then the shared context carries the session for the rest.
   - Guard scenarios run in separate describe blocks with fresh contexts, independent of the journey.

3. **Test names equal the scenario titles** in `specs/e2e-journey/spec.md`. Two helpers: `uniqueEmail()` (timestamp + random suffix on `@e2e.test`) and a fixed password that satisfies the shared schema.

4. **Stack startup through Playwright `webServer`** (array of two):
   - API: `pnpm --filter @todo/backend exec tsx src/server.ts` with `env: { PORT: 3100, DATABASE_URL: <todo_e2e URL>, JWT_SECRET: <fixed 32+ char test value>, NODE_ENV: "test" }`. Environment variables override `.env`, so the dev database is never used. Readiness: `url` of a cheap known route (checked at apply; any HTTP answer counts via `ignoreHTTPSErrors`/status ok).
   - Web: `pnpm --filter @todo/frontend exec vite --port 5180 --strictPort` serving the dev app, with `API_PROXY_TARGET` made overridable by an env var **only if** needed. Because the proxy target is a constant in production source, the frontend must reach the API on 3000. Decision: run the E2E API on port **3000** too and make it fail fast with a clear message if the port is taken (`reuseExistingServer: false`), instead of editing frontend source. A developer's running dev backend must be stopped; documented in the README of the package.
   - Both `webServer` entries start with `reuseExistingServer: false` so a stale dev backend can never be mistaken for the E2E one.
   - Web port 5180 (not 5173) so a running dev frontend does not conflict.

5. **Database: `todo_e2e` created in the same Postgres container.** A script `src/prepare-db.ts`, run as the first part of the API `webServer` command (Playwright starts web servers before `globalSetup`, so a global setup would be too late), (a) connects to the maintenance DB and runs `CREATE DATABASE todo_e2e` if absent, (b) runs `prisma migrate deploy` with `DATABASE_URL` pointing at it. Connection uses the `pg` package already in the backend; it is resolved from the backend workspace rather than adding a dependency to `apps/e2e`. Reruns need no cleanup because each run registers a unique user (spec: "Reruns do not collide"). A script `pnpm test:e2e:reset` that drops the database is out of scope; `docker compose down -v` already does that.
   - Alternative: unique user on the dev database; rejected (pollutes real data, fails the isolation requirement).

6. **Locators.** Prefer `getByRole`/`getByLabel`/`getByText` with the names already fixed by the frontend specs (**New note**, **Save**, **New tag**, **Share**, **History**, **Trash**, **Restore**, **Log out**, dialog "Share this note"). Autosave is awaited by the saved-status text, then verified by `page.reload()`. Highlight is asserted on `page.locator("mark")` inside the result. The anonymous check uses `browser.newContext()` with no storage state. If a control lacks an accessible name, record it as a follow-up rather than adding test ids to production code in this ticket.

7. **Config scenarios are verified by a Vitest unit test** (`apps/e2e/src/config.test.ts`) that imports the Playwright config and asserts the database name, ports, `reuseExistingServer: false`, trace/screenshot `retain-on-failure`, `retries: 0` and `outputDir`. That is what makes "uses own database", "reruns do not collide" (unique email helper) and "failure evidence" testable with exactly one named test each. `pnpm test` runs this Vitest file (fast, no browser); `pnpm test:e2e` runs Playwright. Vitest is already a pinned workspace dependency version (5.0.5).

8. **Dependency:** `@playwright/test` pinned exactly; the version and the `webServer`, `test.describe.configure({ mode: "serial" })` APIs are confirmed with Context7 during apply (pnpm `onlyBuiltDependencies` unaffected). Browsers installed once with `pnpm --filter @todo/e2e exec playwright install chromium`.

## Risks / Trade-offs

- [Port 3000/5180 already in use] -> `strictPort`, `reuseExistingServer: false`, clear README note.
- [Autosave timing flakiness] -> wait on the saved status (auto-retrying assertion) with the 1 s debounce inside the default expect timeout; raise the per-assertion timeout for that one step only.
- [Serial journey: early failure hides later ones] -> trace and screenshot per test; guard scenarios stay independent.
- [`todo_e2e` schema drift] -> `migrate deploy` runs on every start, so new migrations apply automatically.
- [Frontend proxy constant forces API port 3000] -> accepted to avoid touching production code; revisit if CI needs another port.
- [`prisma migrate deploy` needs the generated client / config] -> reuse `pnpm --filter @todo/backend migrate:deploy` with `DATABASE_URL` overridden.

## Migration Plan

Additive. Developer steps: `docker compose up -d`, `pnpm install`, `playwright install chromium`, stop any local backend, `pnpm test:e2e`. Rollback: revert the commits.

## Open Questions

- Whether CI should run the suite and on which trigger (separate ticket; does not change specs or tasks here).
