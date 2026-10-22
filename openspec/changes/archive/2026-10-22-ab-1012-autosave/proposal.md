# Proposal

## Why

AB-1012 shipped the note editor with explicit save only. FR-FE-5 (docs/FRS.md section 2.7, ticket AB-1012) requires edits to be saved automatically after a short idle period and on leaving the editor, with visible saving, saved and error states, and no dropped edits. docs/SDS.md section 10 records this as a **gap**. AB-1012 skipped autosave on purpose: every changed `PATCH` records a version (FR-VER-1), so saving about once per typing pause would flood the history drawer shipped in AB-1015. This change closes the gap and removes that cost.

## What Changes

- **Debounced autosave** in the editor: about 1 s after the last edit, a `PATCH /notes/{id}` with the changed fields is sent. One save is in flight at a time; edits made meanwhile are queued as a single follow-up save of the latest state.
- **Save status**: "Unsaved changes" (waiting), "Saving", "Saved", and "Couldn't save" with a **Retry** button. Edits are never dropped on failure. There is no automatic retry loop; the next edit or **Retry** re-arms saving.
- **Flush on leave**: leaving the editor sends any pending save first. The discard dialog appears only if that save fails (or the title is blank).
- **New notes**: the first `POST /notes` happens automatically once the title is non-blank and the user pauses; the route then moves to `/notes/<id>` without losing text typed during the request.
- **Explicit Save kept**: **Save** and `Ctrl/Cmd+S` stay as "save now": they cancel the pending timer and send immediately.
- **Version coalescing (backend)**: `PATCH /notes/{id}` accepts an optional `autosave: true`. An autosave patch is merged into the note's newest version instead of adding one when that version was itself created by an autosave and is less than 5 minutes old. Explicit saves, creating a note and restoring a version always add a new version and are never overwritten by an autosave. The 5 minutes run from the version's creation, so a long editing session still yields a version about every 5 minutes.
- **Schema**: one additive column, `NoteVersion.coalescible` (boolean, default false), marks versions an autosave may still update.
- **Docs**: FRS FR-VER-1 is reworded (a version per save, except coalesced autosaves) and SDS section 4/5/10 are updated. This needs the human's approval at Gate 1.

Decisions fixed for this ticket (see design.md): debounce 1000 ms; coalescing window 5 minutes. Nothing is breaking: `autosave` is optional and defaults to false, so existing clients behave as before.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `notes`: the **Update note** requirement accepts the optional `autosave` flag.
- `versions`: the **Versions are recorded and numbered** requirement gains the coalescing rule.
- `frontend-note-editor`: **Creating a note**, **Editing a note**, **Unsaved-changes guard** and **Save failures** change from explicit-save-only to autosave plus explicit save; a new **Autosave** requirement is added.

## Impact

- `packages/shared`: `updateNoteRequestSchema` gains `autosave`.
- `apps/backend`: `versions/record-save.ts` (coalescing), `notes/notes.service.ts` (pass the flag), `prisma/schema.prisma` plus one migration. Restore keeps calling the same save function without the flag.
- `apps/frontend`: `components/editor/NoteEditor.tsx` (scheduler, status, flush), `pages/NoteEditorPage.tsx` (no remount on create), editor tests.
- `delta-openapi.yaml`: `PATCH /notes/{id}` request body.
- Docs: `docs/FRS.md` FR-VER-1, `docs/SDS.md` (NoteVersion table, autosave row, status table), `apps/frontend/CLAUDE.md` AB-1012 note ("there is no autosave").
- Rollback: revert the commits. The migration only adds a defaulted column; leaving it in place is harmless. Existing versions all read `coalescible = false`, so nothing already stored is ever rewritten.
- Out of scope: trash UI, list sorting, auto-purge, E2E (AB-1016), conflict detection between tabs (last write wins, as before), offline queueing, and a "make this a checkpoint" action for an already-saved state.
