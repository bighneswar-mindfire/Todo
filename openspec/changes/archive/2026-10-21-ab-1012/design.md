## Context

AB-1011 shipped the notes list. The backend already supports note create, read, update, soft delete (AB-1004), tag attach/detach (AB-1006) and versioning (AB-1009). This ticket adds the TipTap editor page and two list-page additions. Frontend only: no change to `packages/shared`, the backend, Prisma or migrations. Specs: `frontend-note-editor` (new) and `frontend-notes-list` (delta). `delta-openapi.yaml` has empty `paths`.

## Goals / Non-Goals

**Goals:** create, open, edit (explicit save), tag and soft-delete a note from the UI; never lose the user's edits on failure; never show a false "Unsaved changes".

**Non-Goals:** autosave, trash/restore UI, search, sharing, version history UI, tag create/edit/delete UI, images/links/tables, collaboration, Playwright E2E.

## Decisions

**D1 Routes and remount.** `routes/router.tsx` adds `/notes/new` and `/notes/:id` under `RequireAuth`, both rendering `pages/NoteEditorPage.tsx`. The page reads `useParams().id` (undefined = create) and renders `<NoteEditor key={id ?? "new"} />`, so changing notes resets all local state. `/notes/new` is a static path and wins over `:id`.

**D2 Data layer.**
- `api/notes.ts` gains `getNote`, `createNote`, `updateNote`, `deleteNote`, `attachTag`, `detachTag` on `request()`. JSON replies are validated with `noteSchema`; bodies are parsed with `createNoteRequestSchema` / `updateNoteRequestSchema`; 204 replies resolve with no value.
- `queries/note.ts` holds `noteKeys.detail(id)`, `useNote(id)` (`staleTime: 30_000` so a note seeded after create is not refetched) and the mutations. The query client's default retry already skips 4xx.
- `GET /notes/{id}` answering 400 `VALIDATION_ERROR` (malformed id) is shown as "Note not found", same as 404.
- Save, create, delete and tag toggles invalidate `notesKeys.all` and `notesKeys.tags`. Save also writes the returned note to `noteKeys.detail(id)`. Tag attach/detach patches `tags` in the cached detail from the `useTags()` data (the 204 has no body).

**D3 Dirty tracking.** Baseline = `{ title, contentJson }` with `contentJson = JSON.stringify(editor.getJSON())`.
- The baseline content is captured from the editor after it is created with the loaded content, not from the server body: TipTap normalises documents, and comparing with raw server JSON would flag an untouched note as dirty.
- `dirty = title.trim() !== baseline.title || contentJson !== baseline.contentJson`, a derived value. Typing the original title back clears it.
- Content is mirrored to state from `onUpdate`.
- After a successful save the baseline becomes the values that were *sent*, so keystrokes made during the request stay dirty.
- Pure helpers (`lib/note-diff.ts`: `diffNote`, `isDirty`, `contentKey`) carry this logic and are unit-tested.

**D4 Save.**
- The payload is a diff against the baseline: `title` (trimmed) only if changed, `content` only if changed. Create always sends both.
- Title is validated client-side with `createNoteRequestSchema.shape.title`; a blank title shows "Title is required" (`role="alert"`, `aria-invalid`, `aria-describedby`) and sends nothing.
- Create: `POST`, seed `noteKeys.detail(new.id)`, then `navigate("/notes/<id>", { replace: true })`. Update: `PATCH`.
- **Save** is disabled while a save is pending; the Ctrl/Cmd+S handler checks the same flag, so duplicates cannot be sent.
- Ctrl/Cmd+S is a `keydown` listener on `document` that calls `preventDefault()` and runs the same save function as the button.
- Failure shows a `FormAlert`; title, content, baseline and **Save** state are untouched. A 400 `VALIDATION_ERROR` with a `title` detail appears under the input; other errors use `GENERIC_ERROR`. A 404 on `PATCH` switches the page to the not-found state.
- "Saved" is shown after a successful save and cleared on the next edit.

**D5 Unsaved-changes guard.**
- `useBlocker` blocks when `dirty && !bypass && current pathname !== next pathname`; the blocker state opens `DiscardChangesDialog` (**Stay** = `blocker.reset()`, **Discard changes** = `blocker.proceed()`).
- A `beforeunload` listener exists only while dirty and calls `preventDefault()`.
- A `bypassRef` is set just before the programmatic navigations after create and after delete, so neither prompts.
- This needs a data router; the app (`createBrowserRouter`) and tests (`createMemoryRouter`) both use one.

**D6 Editor.** `components/editor/RichTextEditor.tsx` wraps `useEditor` with `StarterKit.configure({ link: false, underline: false })` (v3 bundles both; the toolbar has neither; option names are verified against Context7 during implementation). `editorProps.attributes` sets `role="textbox"`, `aria-label="Note content"`, `aria-multiline`. `components/editor/Toolbar.tsx` renders `role="toolbar"` labelled "Formatting" with 11 buttons from one config array; `aria-pressed` and Undo/Redo `disabled` come from `useEditorState`. Buttons use `onMouseDown` + `preventDefault` so the editor keeps focus and selection.

**D7 Tags on a note.** `components/editor/NoteTagPicker.tsx` reuses `useTags()`, `textColorFor` and the loading / failure / retry pattern of `TagFilter`.
- Toggle buttons use `aria-pressed` derived from the cached note's `tags`, so the state changes on success only. The pending button is disabled.
- A 404 on attach refetches tags and shows an alert; other failures show an alert and change nothing.
- On `/notes/new` the group is disabled with "Save the note to add tags". Also: "No tags yet" and "Couldn't load tags" + **Retry**. Toggles never touch the dirty state or send `PATCH`.

**D8 Dialog.** `components/ui/dialog.tsx` is a hand-copied, dependency-free dialog (as in AB-1010/1011): a portal with a backdrop and a `div role="dialog" aria-modal="true" aria-labelledby`. It focuses the first control on open, traps Tab, closes on Escape and restores focus to the opener. Native `<dialog>.showModal()` is rejected because jsdom support is unreliable. It serves `DeleteNoteDialog` and `DiscardChangesDialog`.

**D9 Delete.** `DELETE /notes/{id}`; on 204 or 404 the page sets the bypass, invalidates the list and tags, removes the detail query and navigates to `/`. Other failures keep the dialog open with an alert and **Delete note** enabled. No **Delete** on `/notes/new`. Copy never promises permanent removal.

**D10 Load states.** In order: pending, `role="status"` "Loading note"; 404/400, "Note not found" + link to `/`; any other error or `noteSchema` failure, `role="alert"` + **Retry**; otherwise the editor. Exactly one `h1` in every state.

**D11 List page.** `NoteListItem` wraps the title in a `Link` to `/notes/<id>` (still the row's `h2`). `NotesPage` header gets a **New note** link (`buttonVariants`) to `/notes/new`; being in the header it shows in every list state.

## Dependencies

`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, all pinned to `3.32.0` (no ranges). `test-setup.ts` gains jsdom shims ProseMirror needs: `Range.prototype.getClientRects` / `getBoundingClientRect`, `document.elementFromPoint`, `Element.prototype.scrollIntoView`.

## Risks / Trade-offs

- **ProseMirror under jsdom** (selection, typing) may be flaky. Mitigation: shims, toolbar-driven tests, and `editor.commands` for setup where typing is unreliable.
- **No conflict detection:** last write wins (the backend has none).
- **Save creates a version each time** (AB-1009), hence explicit save instead of autosave.
- **Pre-commit hook** can time out under load (5 s); re-run the commit.

## Migration Plan

None. No data or API change; the feature is additive.

## Open Questions

None.
