## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command (`$env:Path = "$env:APPDATA\fnm\node-versions\v22.23.3\installation;" + $env:Path`).
- Model per task: Haiku = boilerplate, Sonnet = implementation, Opus = architecture only. No Opus task (design.md is approved).
- No task is estimated over 45 minutes, so no subagent is needed. `[PARALLEL]` marks tasks that touch separate files and can run in separate worktrees.
- Test files hold one test per scenario, titled exactly as the scenario. 69 scenarios, 69 test tasks: 6 (phase 1) + 4 (phase 2) + 37 (phase 3) + 18 (phase 4) + 4 (phase 5). Extra unit tests (helpers, dialog) are not scenarios and are labelled "Unit".
- Frontend tests stub `fetch` through `src/test/fake-api.ts` (no MSW). `test-setup.ts` resets the session, `localStorage` and the fake API before each test.
- `@todo/shared` is consumed from `dist/`. No shared change is planned.
- New dependencies `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, all exactly `3.32.0`. Re-check TipTap v3 APIs (`StarterKit.configure` option names for link/underline, `useEditorState`, `editor.can()`) with Context7 before using them; the user runs `pnpm install` if the sandbox cannot.
- One commit per phase after its checkpoint: `feat(frontend): description AB#1012`. The pre-commit hook can time out under load (5 s); re-run the commit.

## 1. Dependencies, API functions, queries and test infrastructure

- [x] 1.1 Add `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm` at `3.32.0` (exact) to `apps/frontend/package.json` and update `pnpm-lock.yaml` (Haiku)
- [x] 1.2 Extend `src/api/notes.ts`: `getNote`, `createNote`, `updateNote`, `deleteNote`, `attachTag`, `detachTag` on `request()` with `auth: "bearer"`; JSON replies parsed with `noteSchema`; bodies built through `createNoteRequestSchema` / `updateNoteRequestSchema`; 204 resolves with no value (Sonnet)
- [x] 1.3 [PARALLEL] Create `src/lib/note-diff.ts`: `contentKey(doc)`, `diffNote(baseline, current)` (returns only changed `title` (trimmed) / `content`), `isDirty(baseline, current)` (Sonnet)
- [x] 1.4 [PARALLEL] Create `src/queries/note.ts`: `noteKeys.detail(id)`, `useNote(id)` (`staleTime: 30_000`), `useSaveNote`, `useDeleteNote`, `useToggleNoteTag` with the invalidation and cache writes from design D2/D7/D9 (Sonnet)
- [x] 1.5 [PARALLEL] Extend `src/test/fixtures.ts`: `makeFullNote(overrides)` (valid `noteSchema` note), `doc(...blocks)` / `paragraph(text)` TipTap JSON builders (Haiku)
- [x] 1.6 [PARALLEL] Add jsdom shims to `src/test-setup.ts`: `Range.prototype.getClientRects` / `getBoundingClientRect`, `document.elementFromPoint`, `Element.prototype.scrollIntoView` (Haiku)
- [x] 1.7 Unit tests in `src/lib/note-diff.test.ts`: only-title diff, only-content diff, both, none, whitespace-only title change is clean, key stability (Haiku)

`src/api/notes.test.ts` - Requirement: Notes API functions
- [x] 1.8 Test "getNote calls the item endpoint"
- [x] 1.9 Test "createNote posts the body"
- [x] 1.10 Test "updateNote patches only what it is given"
- [x] 1.11 Test "deleteNote accepts 204"
- [x] 1.12 Test "attachTag and detachTag use the tag routes"
- [x] 1.13 Test "Malformed note response is rejected"

- [x] 1.14 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. Dialog, rich-text editor and toolbar

- [x] 2.1 [PARALLEL] Create `src/components/ui/dialog.tsx`: portal, backdrop, `role="dialog" aria-modal="true" aria-labelledby`, focus first control on open, Tab trap, Escape closes, focus restored to the opener (Sonnet)
- [x] 2.2 [PARALLEL] Create `src/components/editor/RichTextEditor.tsx`: `useEditor` with `StarterKit.configure({ link: false, underline: false })`, `editorProps.attributes` (`role="textbox"`, `aria-label="Note content"`, `aria-multiline`), `onUpdate`/`onCreate` callbacks, renders the toolbar plus `EditorContent` (Sonnet)
- [x] 2.3 Create `src/components/editor/Toolbar.tsx`: `role="toolbar"` labelled "Formatting", 11 buttons from one config array, `aria-pressed` and Undo/Redo `disabled` from `useEditorState`, `onMouseDown` preventDefault (Sonnet)
- [x] 2.4 Unit tests in `src/components/ui/dialog.test.tsx`: Escape closes, Tab wraps inside, focus returns to the opener, labelled by its title (Haiku)

`src/components/editor/RichTextEditor.test.tsx` - Requirement: Rich-text editing
- [x] 2.5 Test "Toolbar lists the formatting actions"
- [x] 2.6 Test "Bold toggles on the selection"
- [x] 2.7 Test "Heading and list blocks can be applied"
- [x] 2.8 Test "Undo and redo track history"

- [x] 2.9 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 3. Editor page: routes, load states, create, edit, guard

- [x] 3.1 Create `src/components/editor/DiscardChangesDialog.tsx` (**Stay** / **Discard changes**) on the shared dialog (Haiku)
- [x] 3.2 Create `src/pages/NoteEditorPage.tsx`: reads `:id`, renders `<NoteEditor key={id ?? "new"}>`; load states (D10), header with back link and one `h1` (Sonnet)
- [x] 3.3 Implement the `NoteEditor` body: title input (label "Title", `maxLength` 200), baseline/dirty state (D3), "Unsaved changes" / "Saved" indicators, Save button, `FormAlert` for failures (Sonnet)
- [x] 3.4 Implement save (D4): title validation with the shared title rule, diff payload, create then seed cache and `navigate(..., { replace: true })`, in-flight guard, Ctrl/Cmd+S listener, server title error mapping, 404 to not-found (Sonnet)
- [x] 3.5 Implement the guard (D5): `useBlocker` with `dirtyRef`/`bypassRef`, `beforeunload` while dirty (Sonnet)
- [x] 3.6 Add routes `/notes/new` and `/notes/:id` under `RequireAuth` in `src/routes/router.tsx` (Haiku)

`src/pages/NoteEditorPage.test.tsx` - Requirement: Editor routes
- [x] 3.7 Test "Unauthenticated visit is redirected"
- [x] 3.8 Test "New note starts empty"
- [x] 3.9 Test "Existing note is loaded"
- [x] 3.10 Test "Back link returns to the list"

Requirement: Rich-text editing
- [x] 3.11 Test "Stored content round-trips"

Requirement: Creating a note
- [x] 3.12 Test "Save is disabled without a title"
- [x] 3.13 Test "Create sends trimmed title and content"
- [x] 3.14 Test "Create moves to the edit URL"
- [x] 3.15 Test "Create refreshes the list"

Requirement: Editing a note
- [x] 3.16 Test "Save is disabled when nothing changed"
- [x] 3.17 Test "Editing enables Save and shows the dirty marker"
- [x] 3.18 Test "Only the title is sent when only the title changed"
- [x] 3.19 Test "Only the content is sent when only the content changed"
- [x] 3.20 Test "Successful save resets the baseline"
- [x] 3.21 Test "Reverting an edit clears the dirty state"
- [x] 3.22 Test "Keyboard shortcut saves"
- [x] 3.23 Test "Save refreshes the list"

Requirement: Title validation
- [x] 3.24 Test "Blank title is rejected locally"
- [x] 3.25 Test "Server title error is shown"

Requirement: Unsaved-changes guard
- [x] 3.26 Test "Clean page leaves without a prompt"
- [x] 3.27 Test "Dirty page asks before leaving"
- [x] 3.28 Test "Stay keeps the edits"
- [x] 3.29 Test "Discard leaves the page"
- [x] 3.30 Test "Browser unload is guarded only when dirty"
- [x] 3.31 Test "Saving then navigating does not prompt"

Requirement: Save failures
- [x] 3.32 Test "Server error keeps edits"
- [x] 3.33 Test "Network failure keeps edits"
- [x] 3.34 Test "Retrying after failure succeeds"
- [x] 3.35 Test "Double click sends one request"
- [x] 3.36 Test "Note disappears while editing"

Requirement: Load states
- [x] 3.37 Test "Loading state"
- [x] 3.38 Test "Missing note"
- [x] 3.39 Test "Malformed id is not found"
- [x] 3.40 Test "Load failure can be retried"
- [x] 3.41 Test "Invalid response body is a failure"
- [x] 3.42 Test "Switching notes resets the editor"

Requirement: Editor accessibility baseline
- [x] 3.43 Test "Controls have accessible names"

- [x] 3.44 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 4. Tags on a note and delete

- [ ] 4.1 [PARALLEL] Create `src/components/editor/NoteTagPicker.tsx` (D7): group labelled "Tags", `aria-pressed` toggles coloured with `textColorFor`, per-button pending, disabled state for new notes, empty and failure states (Sonnet)
- [ ] 4.2 [PARALLEL] Create `src/components/editor/DeleteNoteDialog.tsx` (D9): title "Delete this note?", **Cancel** / **Delete note**, failure alert, 404 counts as success (Sonnet)
- [ ] 4.3 Wire both into `NoteEditor`: picker below the title, **Delete** button (saved notes only) that opens the dialog, bypass + invalidate + navigate to `/` on delete (Sonnet)

`src/pages/NoteEditorPage.test.tsx` - Requirement: Tags on a note
- [ ] 4.4 Test "Attached tags are pressed"
- [ ] 4.5 Test "Pressing a tag attaches it"
- [ ] 4.6 Test "Pressing an attached tag detaches it"
- [ ] 4.7 Test "Tag change keeps the state clean"
- [ ] 4.8 Test "Tag change keeps unsaved edits"
- [ ] 4.9 Test "Failed tag change leaves the button alone"
- [ ] 4.10 Test "Tag deleted elsewhere"
- [ ] 4.11 Test "New note cannot take tags yet"
- [ ] 4.12 Test "No tags exist"
- [ ] 4.13 Test "Tags load failure is isolated"

Requirement: Deleting a note
- [ ] 4.14 Test "Delete asks for confirmation"
- [ ] 4.15 Test "Cancel keeps the note"
- [ ] 4.16 Test "Confirming deletes and returns to the list"
- [ ] 4.17 Test "Delete works with unsaved edits"
- [ ] 4.18 Test "Delete failure keeps the dialog"
- [ ] 4.19 Test "Already-deleted note"
- [ ] 4.20 Test "No delete on a new note"

Requirement: Editor accessibility baseline
- [ ] 4.21 Test "Dialog returns focus"

- [ ] 4.22 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 5. List page additions, docs and wrap-up

- [ ] 5.1 [PARALLEL] Edit `src/components/notes/NoteListItem.tsx`: title becomes a `Link` to `/notes/<id>` inside the existing `h2` (Haiku)
- [ ] 5.2 [PARALLEL] Edit `src/pages/NotesPage.tsx`: **New note** link (`buttonVariants`) to `/notes/new` in the header (Haiku)
- [ ] 5.3 [PARALLEL] Update `apps/frontend/CLAUDE.md`: AB-1012 section (editor layout, dirty/baseline rule, bypass ref, dialog, test helpers) and drop "Rows are not links yet" (Haiku)

`src/pages/NotesPage.test.tsx` - Requirements: New note entry point, Rows open the editor
- [ ] 5.4 Test "New note link is shown"
- [ ] 5.5 Test "New note link is shown for an empty account"
- [ ] 5.6 Test "Title links to the editor"
- [ ] 5.7 Test "Clicking a title opens the editor"

- [ ] 5.8 Run `pnpm test --coverage`; confirm thresholds hold and all 69 scenarios have one test each
- [ ] 5.9 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`
