## Context

See proposal.md for motivation. Current state:

- `NoteEditor.tsx` keeps a baseline `{ title, contentJson }`, derives `dirty`, saves through `save()` (guarded by `savingRef`, reachable through `saveRef`), and blocks leaving with `useBlocker` plus `beforeunload` while dirty. `bypassRef` skips the guard after create and delete.
- `NoteEditorPage` remounts the editor with `key={id ?? "new"}`; after a create the route changes from `/notes/new` to `/notes/<id>`, which remounts it and would drop text typed during the request.
- Backend `saveNoteState` (`versions/record-save.ts`) locks the note row `FOR UPDATE`, skips unchanged saves, updates the note and always inserts the next version. `notes.update` and `versions.restore` both call it.
- `NoteVersion` has no field telling who or what created it.

## Goals / Non-Goals

**Goals:** edits reach the server without a click; history stays readable; no edit is ever lost on failure, create, leave or restore; explicit saves stay precise checkpoints.

**Non-Goals:** conflict detection between tabs (last write wins), offline queueing or retry with backoff, a way to turn an already-saved state into a checkpoint, changing the history drawer, trash UI, sorting, auto-purge.

## Decisions

**D1 Contract first.** `packages/shared` `updateNoteRequestSchema` gains `autosave: z.boolean().optional()`. The existing refine still requires `title` or `content`, so `{ autosave: true }` alone is a 400. The flag is not stored on `Note` and not returned. Rejected: a new endpoint (`PUT /notes/{id}/draft`), which duplicates validation and routing for one boolean.

**D2 Coalescing lives in `saveNoteState`.** `SaveInput` gains `autosave?: boolean`. Under the existing row lock, after the unchanged-check:
1. read the newest version (`ORDER BY versionNumber DESC LIMIT 1`);
2. if `autosave` and it is `coalescible` and `now - createdAt < AUTOSAVE_COALESCE_WINDOW_MS` (5 min, a constant in that file), update its `title`, `content`, `contentText` in place;
3. otherwise insert the next version with `coalescible = autosave`.
The note row update is unchanged. Create and restore never pass the flag, so their versions have `coalescible = false`. The row lock makes five concurrent autosaves land as one version. `createdAt` is not touched, so one version covers at most 5 minutes of typing. Rejected: coalescing every patch inside a window (an explicit save would be overwritten by the next autosave and could not be a checkpoint); a client-chosen version number (the server must own numbering).

**D3 One additive column.** `NoteVersion.coalescible Boolean @default(false)` in `schema.prisma`, one new migration. No index (read only for the single newest row, found by the existing unique `(noteId, versionNumber)`). Existing rows read false, so history stored before this change is never rewritten. The `db-change-checker` agent reviews the migration. The SDS NoteVersion table is updated (SDS section 4 says to check existing tables first: the only change is this column). Rejected: no column and time alone (cannot tell an explicit checkpoint from an autosave); a separate table.

**D4 Autosave scheduler in the editor.** Pure logic in `lib/autosave.ts` (a small controller, unit-tested with fake timers) so `NoteEditor` stays readable:
- every edit (title `onChange`, `RichTextEditor` `onChange`) re-arms a 1000 ms timer when the state is dirty and the title is non-blank, and clears it when it is not;
- when the timer fires it calls the shared `save({ autosave: true })`;
- `save()` stays the only sender. It sends `diffNote(baseline, current)` plus `autosave: true` for timer calls, nothing extra for **Save** / `Ctrl+S` (which clear the timer first);
- if a save is in flight when the timer fires or an edit arrives, a `queued` flag is set; when the save settles successfully and the state is still dirty, one more save runs with the latest state. The baseline after success is the values that were sent (as today), so edits made in flight remain dirty;
- on failure `queued` is dropped and no timer is armed; the next edit or **Retry** (same `save`) restarts it. This avoids a retry storm on a hard failure.
Timers and queued saves are cancelled on unmount (restore remounts the editor with a new key, delete navigates away), so a stale autosave cannot overwrite a restored version.

**D5 Status.** One derived status replaces the two spans: `failed` ("Couldn't save" + **Retry**, alert text kept in `FormAlert`), `saving`, `dirty` ("Unsaved changes"), `saved` ("Saved", cleared on the next edit), else nothing. The existing strings keep their current test selectors.

**D6 Leaving.** `useBlocker` still blocks while `dirtyRef` is true. When it reports `blocked`, an effect first calls `save()` (flush, which cancels the timer): on success `blocker.proceed()` runs with no dialog; on failure or a blank title the existing `DiscardChangesDialog` opens (**Stay** = `reset`, **Discard changes** = `proceed`). `beforeunload` is registered while dirty, as today; a reload cannot await a request, so the browser prompt remains the safety net there.

**D7 New note.** `/notes/new` autosaves with `POST` once the title is non-blank and the user pauses. To keep text typed during the request, the page must not remount the editor on the create navigation: `NoteEditorPage` keeps the same editor key across `/notes/new` -> `/notes/<created id>` (the editor navigates with `{ replace: true, state: { created: true } }`, a boolean flag the page validates with a type guard and keys on), and the editor keeps the created id in a ref (`createdIdRef`) instead of waiting for a prop. After create the baseline is the values sent and anything typed since is dirty and goes out as a `PATCH`. Verified with a test that types during a delayed `POST`. Rejected: disabling the editor while creating (blocks typing); creating on the first keystroke (many empty-title notes).

**D8 Blank title.** No request and no error while the user is typing. "Title is required" appears when the title input loses focus (and on **Save** / `Ctrl+S`, as today). Autosave resumes once the title is valid.

**D9 Share and History.** Both dialogs keep their `dirty` prop and messages unchanged ("Unsaved changes are not shared...", "Unsaved changes in the editor will be replaced"). With autosave the flag is true only during the 1 s wait, an in-flight save or a failure, which is exactly when the message is correct. No change to those capabilities' specs.

**D10 Docs.** FRS FR-VER-1 gets the sentence "A burst of autosaves within 5 minutes is stored as one version." and the SDS NoteVersion table, autosave row and section 10 status are updated. `apps/frontend/CLAUDE.md` loses "there is no autosave". The FRS edit needs the human's approval at Gate 1 because specs may not invent rules absent from the FRS.

## Risks / Trade-offs

- **An autosave never becomes a checkpoint** -> **Save** is disabled when the state is already saved, so a user cannot promote it. Accepted: the first save after a pause of more than 5 minutes starts a new version anyway. A checkpoint action is out of scope.
- **Autosave PATCH lands after a restore** -> the editor is unmounted on restore (timers cancelled) and the drawer needs seconds to reach restore, longer than the request. Residual race only if the request is slower than the user; covered by the "Restore cancels a pending autosave" scenario, not by server logic.
- **Remount-free create is subtle** -> one targeted component test plus the scenario "Typing during create is kept".
- **No retry loop** -> a user who walks away after a 500 has unsaved text; mitigated by the `beforeunload` prompt and the visible "Couldn't save" state.
- **Last write wins across tabs** -> unchanged from before; the backend has no conflict detection.
- **Version `createdAt` is the start of the burst** -> list order and the drawer are unaffected; a version's excerpt may change after the user first opened the drawer (the drawer refetches on open).
- **Pre-commit hook** can time out under load (5 s); re-run the commit.

## Migration Plan

1. Merge the shared schema, the migration and the backend change; run `pnpm --filter @todo/backend migrate:deploy`. The column is additive with a default, so old and new backend code can run against it.
2. Ship the frontend. Old frontends never send `autosave`, so they behave as before.
3. Rollback: revert the frontend first, then the backend. The column may stay.

## Open Questions

None that change the specs or tasks. The 1000 ms debounce and 5 minute window are named constants and can be tuned later without a spec change; the specs fix 1000 ms and 5 minutes as the current values.
