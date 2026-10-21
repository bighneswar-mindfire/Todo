## Why

A signed-in user can now see their notes (AB-1011) but cannot create, open, edit or delete one. The backend already supports all of it (AB-1004 notes CRUD, AB-1006 tag attach/detach). This ticket builds the note editor: the TipTap rich-text screen that turns the list into a working notes app, and the base the search, sharing and version-history UI tickets will hang off.

## What Changes

- **Two protected routes**: `/notes/new` (create) and `/notes/:id` (open and edit). Both share one editor page.
- **Create**: title input plus an empty TipTap editor. **Save** calls `POST /notes`, then the app moves to `/notes/<new id>` (history entry replaced).
- **Open and edit**: `/notes/:id` loads `GET /notes/{id}`, fills the title and the editor from the saved TipTap JSON, and **Save** sends `PATCH /notes/{id}` with only the fields that changed.
- **TipTap editor** (StarterKit): bold, italic, strike, heading 1/2, bullet list, ordered list, blockquote, code block, undo, redo, in a labelled toolbar. Buttons expose `aria-pressed`. Content is stored exactly as `editor.getJSON()` (the `tipTapDocSchema` shape the backend validates).
- **Explicit save, no autosave.** Every `PATCH` that changes something creates a note version (AB-1009), so autosave would flood version history. A dirty indicator ("Unsaved changes"), a disabled **Save** when nothing changed, and `Ctrl/Cmd+S` make saving cheap. Leaving with unsaved changes asks for confirmation (browser `beforeunload` plus a router blocker).
- **Tags on the note**: a "Tags" group lists the user's tags from `GET /tags` as toggle buttons. Toggling one calls `PUT /notes/{id}/tags/{tagId}` or `DELETE /notes/{id}/tags/{tagId}` immediately (these are not part of Save) and refreshes the note's tags. On a new, unsaved note the group is disabled with "Save the note to add tags".
- **Delete**: **Delete** opens a confirmation dialog; confirming calls `DELETE /notes/{id}` (soft delete, 204) and returns to `/`.
- **States handled**: loading (`role="status"`), not found (404, also for another user's, deleted or malformed id: "Note not found" with a link back), load failure with **Retry**, field errors from a 400 under the title, save failure alert that keeps the user's edits, session expiry handled by the existing 401 refresh flow.
- **List page additions** (`frontend-notes-list`): a **New note** link to `/notes/new`, and each row's title becomes a link to `/notes/<id>`.
- **Cache**: saving, creating, deleting and tag changes invalidate the notes list and tag counts so `/` is never stale.
- **API layer**: `getNote`, `createNote`, `updateNote`, `deleteNote`, `attachTag`, `detachTag` in `api/notes.ts`, validated with `noteSchema` and the request schemas from `@todo/shared`. No type or schema is redefined in the frontend.
- **New runtime dependencies** (exact versions, verified with Context7 and npm): `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, all `3.32.0`. A shadcn-style dialog is hand-copied as in AB-1010 and AB-1011 (no `@radix-ui` unless the plan finds it necessary).

Decisions fixed for this ticket:
- Title is required, trimmed, at most 200 characters (same rule as `titleSchema`); validated client-side with the shared schema before any request. Content may be empty.
- Save sends only changed fields. A no-change Save is impossible (button disabled), matching the backend's no-op rule.
- Only `getJSON()` is stored. No HTML, no Markdown, no image or link extensions beyond StarterKit defaults.
- Tag create/rename/delete stays out of the editor (separate tags UI ticket); the editor only attaches and detaches existing tags.
- Last write wins. There is no conflict detection between two tabs; the backend has none either.

## Capabilities

### New Capabilities
- `frontend-note-editor`: the create/edit page: routes, TipTap toolbar and content round-trip, save, dirty guard, tags on a note, delete, and the loading, not-found and error states.

### Modified Capabilities
- `frontend-notes-list`: gains a **New note** entry point and linked row titles (ADDED requirements only; no existing requirement changes).

No backend capability changes.

## Impact

- `apps/frontend`: new `src/pages/NoteEditorPage.tsx`, `src/components/editor/*` (editor, toolbar, tag picker, delete dialog), `src/queries/note.ts` (query and mutation hooks), new API functions in `src/api/notes.ts`, two new routes in `src/routes/router.tsx`, `NoteListItem` and `NotesPage` edits, new `components/ui/dialog.tsx`, `fake-api` and fixtures extended. TipTap needs small jsdom shims in `test-setup.ts`.
- `packages/shared`: no change expected (all schemas already exist).
- Backend, Prisma, migrations: no change.
- `delta-openapi.yaml`: declares **no new or changed endpoints** (`paths` empty). It documents the six endpoints used under `x-frontend-consumes`, including how the UI reacts to each status code (same approach as AB-1010 and AB-1011).
- Out of scope: autosave, trash view and restore UI, search (AB-1013), sharing UI, version history UI, tag create/edit/delete UI, images, links, tables, Markdown shortcuts beyond StarterKit defaults, collaboration, attachments, Playwright E2E (AB-1016).
