# Tasks

Test names equal the scenario titles in `specs/`. Every new scenario has exactly one test; the scenarios kept from the current specs keep their existing tests, edited where the spec text changed.

## 1. Shared contract (`packages/shared`)

- [x] 1.1 Write failing tests in `shared.test.ts` for `updateNoteRequestSchema`: accepts `{ content, autosave: true }`, rejects `{ autosave: true }` alone, rejects `autosave: "yes"`, defaults to no flag. Verify with `pnpm --filter @todo/shared test` (red).
- [x] 1.2 Add `autosave: z.boolean().optional()` to `updateNoteRequestSchema` in `packages/shared/src/notes.ts` without touching the refine. Verify the 1.1 tests pass and `pnpm build` has 0 errors.
- [x] 1.3 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test` green. Commit.

## 2. Database (`apps/backend/prisma`)

- [x] 2.1 Add `coalescible Boolean @default(false)` to `NoteVersion` in `schema.prisma` and generate one migration. Verify `pnpm --filter @todo/backend migrate:deploy` and `generate` succeed on a fresh database and existing rows read false.
- [x] 2.2 Run the `db-change-checker` agent on the migration (data loss, locks, indexes) and record its verdict in the commit message. Verify no blocking finding is left open.

## 3. Backend coalescing (`apps/backend`)

- [x] 3.1 Write failing tests in `notes.update.test.ts`, titled as the `notes` scenarios: Autosave patch is accepted, Autosave flag alone rejected, Non-boolean autosave rejected, Autosave cannot touch another user's note, Unchanged autosave records nothing. Verify they fail for the right reason.
- [x] 3.2 Write failing tests in `versions.record.test.ts`, titled as the `versions` scenarios: Autosaves in a burst share one version, Autosave after the window adds a version (backdate the version's `createdAt` in the test), Autosave never overwrites an explicit version, Explicit save after an autosave adds a version, Concurrent autosaves share one version, Restore after an autosave adds a version, Autosave on a deleted note is rejected. Verify they fail.
- [x] 3.3 Implement D2 in `versions/record-save.ts` (`autosave` input, `AUTOSAVE_COALESCE_WINDOW_MS`, update-in-place or insert with `coalescible`), pass `autosave` from `notes.service.ts` `update` and the PATCH route. Restore and create stay unchanged. Verify 3.1, 3.2 and the existing notes and versions suites pass, including Concurrent saves get consecutive numbers.
- [x] 3.4 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test --coverage` (new code at least 80%) green. Commit.

## 4. Frontend data layer (`apps/frontend`)

- [x] 4.1 Write failing tests: `api/notes` `updateNote` sends `autosave: true` only when asked and still parses the body with `updateNoteRequestSchema`; `useSaveNote` passes the flag through; `test/fake-api.ts` records the flag. Verify red, then add `autosave?` to `updateNote`, `SaveNoteInput` and `useSaveNote`, and the fake. Verify green.
- [x] 4.2 Write failing unit tests for `lib/autosave.ts` with fake timers (fires once 1000 ms after the last edit, restarts on edit, does not arm for a clean or blank-title state, cancel, queued save runs once after the in-flight one, no re-arm after a failure), then implement it. Verify green.
- [x] 4.3 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test` green. Commit.

## 5. Editor autosave (`apps/frontend`)

- [ ] 5.1 Write failing component tests in `NoteEditorPage.test.tsx`, titled as the `Autosave` scenarios: Idle edit is autosaved, Typing restarts the timer, Status follows the save, Edits during a save are queued, Blank title is not autosaved, Failed autosave keeps edits and offers retry, Retry after a failed autosave, Explicit save is immediate, Autosave of a note that is gone, Server rejects the autosaved title. Verify red.
- [ ] 5.2 Wire the controller into `NoteEditor.tsx` (D4, D5, D8): timer on edits, `autosave: true` on timer saves, queued follow-up, status text and **Retry**, blank-title blur message, **Save** and `Ctrl+S` cancel the timer. Verify the 5.1 tests pass and the edited existing scenarios (Only the title is sent when only the title changed, Only the content is sent when only the content changed, Reverting an edit clears the dirty state, Keyboard shortcut saves) pass.
- [ ] 5.3 Write failing tests titled New note is created on idle and Typing during create is kept (delayed `POST`); implement D7 in `NoteEditorPage.tsx` and `NoteEditor.tsx` (stable key across create, created id from route state). Verify green and that Create moves to the edit URL still passes.
- [ ] 5.4 Write failing tests titled Pending save is flushed on leave, Blank title asks before leaving, Delete cancels a pending autosave, Restore cancels a pending autosave; implement D6 (flush in the blocked-navigation effect) and cancel timers on unmount. Verify green together with the edited scenarios Dirty page asks before leaving (now a failed flush) and Browser unload is guarded only when dirty.
- [ ] 5.5 Update `apps/frontend/CLAUDE.md` (AB-1012 section: autosave, status, flush, no remount on create; remove "there is no autosave"). Verify no stale sentence remains with a search for "no autosave".
- [ ] 5.6 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test --coverage` (new code at least 80%) green. Commit.

## 6. Docs and spec checks

- [ ] 6.1 Update `docs/FRS.md` FR-VER-1 (burst of autosaves within 5 minutes is one version) and `docs/SDS.md` (NoteVersion table `coalescible`, autosave row, section 10 gap marked implemented with the date). Verify the wording matches the specs and the open-API delta.
- [ ] 6.2 Run `pnpm exec openspec validate ab-1012-autosave --strict`. Verify it passes and that a search of the change shows every new scenario title appears as exactly one test title.
- [ ] 6.3 Manual smoke on a dev database: edit a note for a minute, check the History drawer shows one autosave version plus any explicit ones, restore a version, leave with a failing API (stop the server), reload with unsaved text. Record the outcome in the PR.

## Workflow follow-up

- Gate 1: human approves the spec, including the FRS FR-VER-1 wording.
- Verify in a fresh session with `/review ab-1012-autosave` (`reviewer` and `security-auditor`), then `/create-pr ab-1012-autosave`.
- After merge: `/opsx:sync ab-1012-autosave` then `/opsx:archive ab-1012-autosave`.
