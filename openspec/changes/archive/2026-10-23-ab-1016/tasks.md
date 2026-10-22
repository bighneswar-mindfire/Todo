## 1. Scaffold the E2E package

- [x] 1.1 Verify `@playwright/test` APIs with Context7, then add `apps/e2e` (`@todo/e2e`, private, ESM, tsconfig extending the base) with the exact-pinned `@playwright/test`, `playwright.config.ts` skeleton, root script `test:e2e`, `.gitignore` entries (`test-results`, `playwright-report`). Verify: `pnpm install` is clean, `pnpm build` 0 errors, `pnpm exec playwright --version` runs, `pnpm lint --max-warnings 0` passes.
- [x] 1.2 Write the failing Vitest config tests in `apps/e2e/src/config.test.ts`, one per scenario: "E2E run uses its own database", "Reruns do not collide", "Failure evidence is configured". Verify: the three tests fail for the right reason (`pnpm --filter @todo/e2e test`).
- [x] 1.3 Implement `playwright.config.ts` (two `webServer` entries, `reuseExistingServer: false`, retries 0, traces/screenshots on failure, `outputDir`), `src/env.ts` constants, `uniqueEmail()` helper and `src/prepare-db.mjs` run from the API start command (create `todo_e2e` if absent, `migrate:deploy` against it). Verify: the config tests from 1.2 pass and `pnpm test` still passes.
- [x] 1.4 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test` all green.

## 2. Journey tests (shared session)

- [x] 2.1 Write the "Register a new account", "Log in with the registered account" and "Create a note" tests (serial describe, shared context), run `pnpm test:e2e` to see them fail, then fix helpers/locators until they pass against the real stack. Verify: `pnpm test:e2e -g "Register a new account|Log in with the registered account|Create a note"` is green on a clean database and on a second run.
- [x] 2.2 Add "Edit with autosave" and "Tag a note" (wait on the saved status, confirm with a reload; create the tag via **New tag**, see the chip in the list). Verify: both pass in a full run.
- [x] 2.3 Add "Search with highlight". Verify: the result contains a `mark` element with the searched word; no fixed sleeps in the file (`grep waitForTimeout apps/e2e` is empty).
- [x] 2.4 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`, `pnpm test:e2e` all green.

## 3. Journey tests (sharing, history, trash)

- [x] 3.1 Add "Share a note", "Anonymous visitor opens the public link" (fresh context, no storage state) and "Revoke the share link" (owner revokes, anonymous reload shows not-found). Verify: all three pass in a full run.
- [x] 3.2 Add "View history and restore a version" (preview an earlier version, restore, new latest version listed). The journey must have produced at least two versions (use **Save**, not autosave, for the second edit in step 2.2 if autosave coalesces). Verify: the test passes in a full run.
- [x] 3.3 Add "Delete and restore from trash" and "Log out". Verify: the restored note shows its tag in the notes list; after log out `/` redirects to `/login`.
- [x] 3.4 Checkpoint: full `pnpm test:e2e` green twice in a row (rerun scenario), plus `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`.

## 4. Guard scenarios

- [x] 4.1 Add "Unauthenticated visit is redirected to login" and "Registration with an invalid password is rejected" in independent describe blocks with fresh contexts (not serial with the journey). Verify: they pass alone (`-g`) and in the full run.
- [x] 4.2 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`, `pnpm test:e2e`.

## 5. Docs and verification

- [x] 5.1 Add `apps/e2e/README.md` (prerequisites, ports, `playwright install chromium`, run, reset the E2E database), update `docs/SDS.md` section 10 (E2E row), `AGENTS.md` / `apps/frontend/CLAUDE.md` pointers and the `apps/e2e` layer notes. Verify: documented commands copy-paste run on a clean checkout.
- [x] 5.2 Final check: map each of the 17 scenarios to its test title (`grep` for exact titles), run `pnpm exec openspec validate ab-1016 --strict`, `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test --coverage`, `pnpm test:e2e`. Verify: all green, no `any`, `@ts-ignore` or `eslint-disable` added.

## Workflow follow-up

- After merge: `/opsx:sync ab-1016` then `/opsx:archive ab-1016`.
- Separate ticket: run the suite in CI.
