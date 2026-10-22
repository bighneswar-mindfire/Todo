## Why

Every feature of the notes app is tested in isolation (Vitest + Supertest on the API, Vitest + Testing Library on the UI against a faked `fetch`). Nothing proves that the real browser, the real Vite proxy, the real API and the real PostgreSQL work together. Ticket AB-1016 closes that gap with the Playwright journey required by FR-E2E-1 (`docs/FRS.md` section 2.8). Its prerequisites (tag creation UI AB-1018, trash and restore UI AB-1019) are archived, so the full journey is now possible.

## What Changes

- Add a Playwright suite (`apps/e2e`, new workspace package `@todo/e2e`) that drives one signed-in user through the whole journey against a real backend, a real frontend and a dedicated PostgreSQL database: register, log in, create a note, edit with autosave, tag, search with highlight, share and open the public link anonymously, revoke, view history and restore a version, delete and restore from trash, log out.
- Add two small guard scenarios the spec rules require: an unauthenticated visit to a protected page redirects to login (authorization denied) and a rejected registration form shows a validation error (validation failure).
- Start the stack from Playwright's `webServer` (backend on a fixed port with an E2E-only `DATABASE_URL`, frontend through Vite so `/api` is proxied as in dev). A global setup applies migrations to the `todo_e2e` database.
- Add the root script `pnpm test:e2e`. The existing `pnpm test` stays fast and does not run the browser suite.
- Add one pinned dev dependency, `@playwright/test`, which FR-E2E-1 requires. Browser binaries are installed with `playwright install chromium` (documented, not committed).
- Update `docs/SDS.md` section 10 and the `apps/frontend/CLAUDE.md` / `AGENTS.md` pointers once the suite exists.

No production code, API contract, database schema or `packages/shared` change. No `delta-openapi.yaml` is needed because no endpoint changes.

## Capabilities

### New Capabilities

- `e2e-journey`: the browser-level acceptance suite for the notes app: which user journey it covers, the isolation guarantees of the run (own database, own user per run, no dependence on the developer's data), and how it is started.

### Modified Capabilities

None. No existing requirement changes; the suite only observes behaviour already specified by `auth`, `notes`, `tags`, `search`, `sharing`, `versions` and the `frontend-*` capabilities.

## Impact

- New: `apps/e2e/` (config, global setup, helpers, spec files), root `package.json` script, `pnpm-lock.yaml`, `pnpm-workspace.yaml` entry through the existing `apps/*` glob, `.gitignore` entries for Playwright output.
- Dependency: `@playwright/test` (exact version, verified with Context7 at apply time).
- Environment: needs Docker Postgres running (`docker compose up -d`) and ports 3100 (API) and 5174 (web) free. The dev database is never touched.
- `eslint.config.js` already covers `apps/**`; E2E files must pass `pnpm lint --max-warnings 0` and `tsc`.

## Out of Scope

- CI workflow and scheduled runs (a follow-up ticket; the suite is written to run headless in CI).
- Cross-browser runs (Chromium only), mobile viewports, visual regression, accessibility audits, load tests.
- Password reset (OTP is console-logged; not part of FR-E2E-1).
- Any change to production code to make it "more testable" beyond what the specs already expose; if a missing accessible name blocks a test, that is raised as a separate small fix, not done silently here.

## Rollback

The change is additive and isolated in `apps/e2e` and one script. Rollback is reverting the commits (or deleting `apps/e2e` and the dependency); the application and its data are unaffected.

## References

Ticket AB-1016. FRS section 2.8 (FR-E2E-1), section 4 traceability. SDS section 10 (status row "E2E (AB-1016)").
