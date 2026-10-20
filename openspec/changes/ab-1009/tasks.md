## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command.
- Model per task: Haiku = boilerplate, Sonnet = implementation. No Opus task (design.md is approved).
- No task is estimated over 45 minutes, so no subagent is needed. `[PARALLEL]` marks tasks that touch separate files and can run in separate worktrees.
- Test files hold one test per scenario, titled exactly as the scenario.
- Pre-existing notes are simulated with `prisma.noteVersion.deleteMany`.

## 1. Shared types

- [x] 1.1 Create `packages/shared/src/versions.ts`: `versionNumberParamSchema` (`id` uuid, `versionNumber` `z.coerce.number().int().min(1)`), `noteVersionSummarySchema`, `noteVersionListResponseSchema` (with `listMeta`), `noteVersionSchema` and inferred types; export from `index.ts` (Haiku)
- [x] 1.2 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. Service

- [x] 2.1 Verify `SELECT ... FOR UPDATE` via `$queryRaw` inside an interactive `$transaction` with Prisma 7 and `@prisma/adapter-pg` using Context7 before coding (Sonnet)
- [x] 2.2 Create `apps/backend/src/versions/record-save.ts`: `saveNoteState(tx, { userId, noteId, next })` with row lock, no-op detection, `contentText` re-derivation and `versionNumber` allocation (Sonnet)
- [x] 2.3 [PARALLEL] Create `apps/backend/src/versions/versions.service.ts`: `createVersionsService({ prisma })` with `list`, `get`, `restore` (Sonnet)
- [x] 2.4 [PARALLEL] Update `apps/backend/src/notes/notes.service.ts`: create writes version 1 in a nested write; update runs `saveNoteState` in a transaction (Sonnet)
- [x] 2.5 Add the three version routes to `notes.routes.ts` (`createNotesRouter` takes a `VersionsService`) and build the service in `app.ts` (Sonnet)
- [x] 2.6 Create `apps/backend/src/versions/test-helpers.ts` (Haiku)
- [x] 2.7 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 3. Scenario tests (`apps/backend/src/versions/`)

`versions.auth.test.ts` - Requirement: Version endpoints require authentication
- [x] 3.1 Test "Missing token rejected" (Sonnet)
- [x] 3.2 Test "Other user's note hidden"

`versions.record.test.ts` - Requirement: Versions are recorded and numbered
- [x] 3.3 Test "Concurrent saves get consecutive numbers" (5-way `Promise.all` PATCH)
- [x] 3.4 Test "Failed save leaves no version"
- [x] 3.5 Test "Versions are immutable snapshots"

`versions.list.test.ts` - Requirement: List versions
- [x] 3.6 Test "List returns versions newest first"
- [x] 3.7 Test "List item is a summary"
- [x] 3.8 Test "List paginates"
- [x] 3.9 Test "Invalid pagination rejected"
- [x] 3.10 Test "List is scoped to the note"
- [x] 3.11 Test "Pre-existing note has empty history"
- [x] 3.12 Test "List for a deleted note"
- [x] 3.13 Test "List with malformed note id"

`versions.get.test.ts` - Requirement: Get version
- [x] 3.14 Test "Get an earlier version"
- [x] 3.15 Test "Unknown version number"
- [x] 3.16 Test "Version of another note not reachable"
- [x] 3.17 Test "Malformed version number rejected"
- [x] 3.18 Test "Get version of a deleted note"
- [x] 3.19 Test "History survives trash and restore"

`versions.restore.test.ts` - Requirement: Restore version
- [x] 3.20 Test "Restore copies the old state"
- [x] 3.21 Test "Restore appends a new version"
- [x] 3.22 Test "Restore re-derives search text"
- [x] 3.23 Test "Restore of the current state is a no-op"
- [x] 3.24 Test "Restore keeps tags"
- [x] 3.25 Test "Restore unknown version"
- [x] 3.26 Test "Restore malformed version number"
- [x] 3.27 Test "Restore on a deleted note"

`notes/notes.create.test.ts` - Requirement: Create note (modified)
- [x] 3.28 Test "Create records version 1"

`notes/notes.update.test.ts` - Requirement: Update note (modified)
- [x] 3.29 Test "Update records a new version"
- [x] 3.30 Test "Unchanged patch records no version"
- [x] 3.31 Test "First edit of a pre-existing note starts its history"
- [x] 3.32 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage`

## 4. Docs

- [x] 4.1 Add a short AB-1009 section to `apps/backend/CLAUDE.md` (Haiku)
- [x] 4.2 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`
