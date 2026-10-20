## Conventions

- Model per task: **Haiku** = boilerplate, **Sonnet** = implementation, **Opus** = architecture only (none needed; decisions are in `design.md`). **[SUBAGENT]** = estimated over 45 min (Rule 6; none this ticket). **[PARALLEL]** = independent, runs in its own git worktree (Rule 7).
- Test titles are the scenario names verbatim (`it("<scenario name>")`) inside `describe("notes: <requirement>")`. Exactly one test per scenario (36 scenarios). Extra tests the design adds (no spec scenario) are prefixed `[design]`.
- Every checkpoint: `pnpm build` (0 errors) -> `pnpm lint --max-warnings 0` -> `pnpm test`, all green before moving on.
- Run shell commands with Node 22 / pnpm 10 on PATH (memory `node22-via-fnm`); Postgres must be up (`docker compose up -d`).
- All types and Zod schemas live in `packages/shared` only (Rule 11). Soft delete sets `deletedAt` only; no code path physically deletes notes (Rule 15). Pin exact versions (Rule 20); no new dependencies expected. Verify any library API in Context7 before use (Rule 9).
- Work on branch `feat/ab-1004-notes-crud` (already created). Commits: `feat(notes): ... AB#1004`.
- Test helpers: simulate note age by writing `deletedAt` through Prisma (5 and 31 days back).

## 0. Prep (Haiku)

- [x] 0.1 Confirm `docker compose up -d` and `pnpm --filter @todo/backend migrate:deploy` are clean and `pnpm test` is green before changes.
- [x] 0.2 Verify against Context7 (Prisma 7, Express 5, Zod): `updateMany` count semantics, `$transaction([findMany, count])`, writing `Json` fields (`InputJsonValue`), Express 5 `express.json({ limit })` and async route handlers, Zod `z.coerce.number()` and `.refine`.

## 1. Shared package (Sonnet)

- [x] 1.1 `packages/shared/src/auth.ts`: add `NOT_FOUND` to `errorCodeSchema`.
- [x] 1.2 `packages/shared/src/notes.ts` (+ export from `index.ts`): `TRASH_RETENTION_DAYS = 30`, `tipTapDocSchema`, `createNoteRequestSchema` (title trimmed 1..200, content defaults to an empty doc), `updateNoteRequestSchema` (at least one field), `noteIdParamSchema`, `pageQuerySchema` (page >= 1, 1 <= limit <= 100, defaults 1 and 20), `noteSchema`, `noteSummarySchema`, `trashNoteSummarySchema`, list response schemas and inferred types.
- [x] 1.3 `[design]` tests in `packages/shared/src/shared.test.ts`: title bounds 0/1/200/201 and whitespace-only; content must have `type: "doc"`; default empty doc; empty patch rejected; `page`/`limit` coercion, defaults and bounds; `NOT_FOUND` in `errorCodeSchema`.
- [x] **Checkpoint 1**: build, lint, test.

## 2. Content text helper and HTTP plumbing

- [x] 2.1 [PARALLEL] (Sonnet) `apps/backend/src/notes/content-text.ts`: `extractText(doc)` per D4 (text nodes in order, space between block nodes, trim and collapse whitespace, skip malformed nodes without throwing).
- [x] 2.2 [PARALLEL] (Haiku) `[design]` tests in `content-text.test.ts`: separate paragraphs do not fuse words; nested lists/marks; empty doc gives `""`; malformed nodes skipped.
- [x] 2.3 [PARALLEL] (Sonnet) Move `parseBody` from `auth/auth.routes.ts` to `apps/backend/src/http/parse.ts`, add `parseQuery` and `parseParams` using the same error mapping (`zodIssuesToDetails`, 400 `VALIDATION_ERROR`); update the auth routes import. Existing auth tests must stay green.
- [x] **Checkpoint 2**: build, lint, test.

## 3. Notes service and router (Sonnet)

- [x] 3.1 `apps/backend/src/notes/notes.service.ts`: `createNotesService({ prisma })` with `create`, `list`, `get`, `update`, `softDelete`, `listTrash`, `restore` per D3, D5, D6, D9 (owner + state in every where; `updateMany` count 0 -> `AppError("NOT_FOUND", 404, "Note not found")`; list = `findMany` + `count` in one transaction; excerpt = first 200 chars of `contentText`; content never selected for lists).
- [x] 3.2 `apps/backend/src/notes/notes.routes.ts`: `createNotesRouter(service, authenticate)`; `authenticate` applied to the whole router; `GET /trash` before `/:id`; `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` (204), `POST /:id/restore`.
- [x] 3.3 `app.ts`: mount at `/notes`, `express.json({ limit: "1mb" })`.
- [x] 3.4 (Haiku) `auth/test-helpers.ts` (or a new `notes/test-helpers.ts`): `registerAndLogin(app)` returning the access token and user id, `createNote(app, token, body)`, and a `setDeletedAt(prisma, id, daysAgo)` helper.
- [x] **Checkpoint 3**: build, lint, test.

## 4. Scenario tests (Sonnet; Haiku for the repetitive files)

Each test file asserts status, error `code` (matching `delta-openapi.yaml`) and database state where the scenario says so.

- [x] 4.1 `notes.auth.test.ts`, `describe("notes: authentication")`:
  - [x] Missing token rejected
- [x] 4.2 `notes.create.test.ts`, `describe("notes: create note")`:
  - [x] Create note with valid input
  - [x] Title is trimmed
  - [x] Content omitted defaults to empty document
  - [x] Plain text derived from content
  - [x] Empty title rejected
  - [x] Overlong title rejected
  - [x] Invalid content rejected
  - [x] Oversized body rejected
- [x] 4.3 `notes.list.test.ts`, `describe("notes: list notes")`:
  - [x] List returns only own active notes
  - [x] List ordered by most recently updated
  - [x] List paginates
  - [x] Excerpt is truncated
  - [x] Invalid pagination rejected
- [x] 4.4 `notes.get.test.ts`, `describe("notes: get note")`:
  - [x] Get own note
  - [x] Other user's note hidden
  - [x] Unknown note
  - [x] Deleted note not retrievable
  - [x] Malformed id rejected
- [x] 4.5 `notes.update.test.ts`, `describe("notes: update note")`:
  - [x] Update title only
  - [x] Update content re-derives text
  - [x] Empty patch rejected
  - [x] Invalid field rejected
  - [x] Cannot update another user's note
  - [x] Cannot update a deleted note
- [x] 4.6 `notes.delete.test.ts`, `describe("notes: soft delete note")`:
  - [x] Delete sets deletedAt only
  - [x] Deleted note leaves the list
  - [x] Delete already-deleted note
  - [x] Cannot delete another user's note
- [x] 4.7 `notes.trash.test.ts`, `describe("notes: trash listing")`:
  - [x] Trash shows own deleted notes
  - [x] Trash excludes notes past 30 days
  - [x] Trash isolated per user
- [x] 4.8 `notes.restore.test.ts`, `describe("notes: restore note")`:
  - [x] Restore within window
  - [x] Restore outside window rejected
  - [x] Restore an active note rejected
  - [x] Cannot restore another user's note
- [x] **Checkpoint 4**: build, lint, test (all 36 scenario tests present, none skipped; `rg "it\\(" apps/backend/src/notes` titles match the spec).

## 5. Docs, verification and commit (Haiku)

- [x] 5.1 Backend README/CLAUDE note: the `/notes` endpoints, the 30-day restore window and the no-purge decision.
- [x] 5.2 `pnpm test --coverage` meets the DoD threshold; `pnpm exec openspec validate ab-1004`.
- [x] 5.3 Manual smoke run: register, login, create, list, patch, delete, see it in trash, restore; a second user's token gets 404 on the first user's note id.
- [x] 5.4 Commit per phase as `feat(notes): ... AB#1004` once green (Husky enforces). Do not push without asking.
- [x] **Checkpoint 5**: build, lint, test.

## After implementation (not part of /implement)

Fresh terminal `/review AB-1004` must be all pass, then `openspec archive`, then `/pr`.
