# Proposal

## Why

Ticket AB-1015 implements FR-FE-8 (version history drawer) from `docs/FRS.md` section 2.7, and keeps FR-FE-9 (never render unsanitized HTML) true for the version preview. The backend (AB-1009) already records a version on every changed save, lists them, returns one in full and restores one as a new version (FR-VER-1 to 5), but the app has no UI for any of it: a user cannot see what a note used to say or go back to it.

## What Changes

- **History button in the note editor** (existing notes only) that opens a **version history drawer**, a panel anchored to the right edge. It is hidden on `/notes/new`.
- **Version history drawer** (FR-FE-8):
  - Lists versions newest first as summaries (version number, title, excerpt, created time). The newest row is labelled "Current".
  - **Load more** appends the next page (20 per page). The list is empty-state aware: a note created before versioning shows "No earlier versions yet".
  - Selecting a row loads that version in full and previews it read-only, with a **Back to versions** action that keeps the loaded rows.
  - **Restore as new version** on any preview except the current version, behind an inline "Restore this version?" confirm. When the editor holds unsaved changes the confirm also says they will be replaced.
  - After a restore the drawer closes, the editor shows the restored title and content with a clean (not dirty) state, and "Version N restored as a new version" is announced.
- **Read-only note rendering shared with the public view**: the AB-1014 `ReadOnlyNote` component moves out of `components/share/` and takes an accessible label, so the preview and the public page render through the same editor schema and never through HTML.
- **Dialog gains a right-hand placement** so the drawer reuses the existing hand-copied focus-trap modal instead of adding a second one.
- **Versions API functions and query hooks** on the existing `request()` client, validated with the shared version schemas. The list uses an infinite query keyed `["versions", noteId, "list"]`, a single preview is keyed `["versions", noteId, "detail", n]`.
- **Out of scope**: backend, database, `packages/shared` and dependency changes; autosave and save-on-back (FR-FE-5, its own change); auto-purge (FR-VER-6); comparing two versions or diffing; deleting a version; restoring into the editor without saving; a version count badge; showing tags of a version (versions hold none); the share dialog (AB-1014); the Playwright journey (AB-1016); button colour (AB-1017).

Decisions fixed with the user: "Load more" pagination (not Previous/Next); autosave on back is a separate change; Restore stays enabled when the editor is dirty and the confirm warns that unsaved edits will be replaced (recommended default, confirmed by going ahead with the proposal).

Assumptions recorded: the newest version equals the saved note, so it is labelled "Current" and offers no Restore (restoring it is a server no-op); the list is refetched every time the drawer opens; a 404 anywhere in the drawer means the note or version is gone and is shown with fixed text that does not distinguish another user's note from a missing one; a version with a `link` mark in its stored content is shown as plain text, as in the public view. When autosave is specified later it must revisit how Restore interacts with edits it has already saved.

Rollback: remove the History button, the drawer and the version API and query files, and restore `ReadOnlyNote` to `components/share/`. No data or API is touched; versions already recorded stay available through the API.

## Capabilities

### New Capabilities
- `frontend-version-history`: the version history drawer (open and close, version list with load more, preview, restore as a new version, effect on the editor), session handling for the version calls, the versions API functions and query cache, and drawer accessibility.

### Modified Capabilities
- `frontend-note-editor`: adds the History button to the editor (ADDED requirement; existing requirements are unchanged).

## Impact

- Frontend only: `apps/frontend/src` (`api/versions.ts`, `queries/versions.ts`, `components/versions/*`, `components/ReadOnlyNote.tsx` (moved from `components/share/`), `components/ui/dialog.tsx`, `components/editor/NoteEditor.tsx`, `pages/NoteEditorPage.tsx`, `pages/SharedNotePage.tsx` (import path), `test/fixtures.ts`).
- `packages/shared`: no new schemas; `noteVersionSummarySchema`, `noteVersionListResponseSchema`, `noteVersionSchema` and `versionNumberParamSchema` already exist.
- No new dependency (TipTap and TanStack Query are already installed). No API, database or backend change; `delta-openapi.yaml` has empty `paths`.
- Deviation from `docs/SDS.md` section 6: the SDS lists the key `["versions", noteId, page]`, but "Load more" needs one growing list, so the list key is `["versions", noteId, "list"]` and the SDS key table needs a one-line update when this change is synced.
- Links: ticket AB-1015, FRS FR-FE-8, FR-FE-9, FR-VER-1 to 5, SDS sections 4.6 (version endpoints), 5.6 (versions) and 6 (frontend).
