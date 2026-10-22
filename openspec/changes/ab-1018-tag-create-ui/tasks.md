# Tasks

## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command (`$env:Path = "$env:APPDATA\fnm\node-versions\v22.23.3\installation;" + $env:Path`).
- Tests first: write the failing test, then the code. One test per spec scenario, titled exactly as the scenario (29 scenarios, all in `frontend-tags`). Extra unit tests are labelled "Unit".
- Tests stub `fetch` with `src/test/fake-api.ts`. Paths in the fake exclude the `/api` prefix.
- No new dependency, no `packages/shared` change, no backend change (there are no shared or API tasks; everything is web). Verify react-hook-form, `@hookform/resolvers` (`zodResolver` with the Zod 4 `error` option) and TanStack Query v5 (`useMutation`, `invalidateQueries`) with Context7 before use.
- One task, one commit: `feat(frontend): description AB#1018`. Each group ends with a checkpoint.
- Branch: `feature/frontend/AB-1018-tag-create-ui` from `main`.

## 1. API function and error mapping (no UI)

- [x] 1.1 Check `makeTag` in `src/test/fixtures.ts` produces a value valid against `tagSchema` (`createdAt` present); add `createdAt` or a `makeCreatedTag(overrides)` helper if not, and verify with a Unit test that parses it with `tagSchema`

`src/api/notes.test.ts` - Requirement: Tag creation API function
- [x] 1.2 Test "createTag posts the validated body"
- [x] 1.3 Test "createTag rejects invalid input without a request"
- [x] 1.4 Test "createTag rejects a malformed response"
- [x] 1.5 Implement `createTag` in `src/api/notes.ts` (parse with `createTagRequestSchema`, `POST /tags`, bearer, response `tagSchema`); verify with `pnpm --filter @todo/frontend test api/notes`

`src/lib/form-errors.test.ts`
- [x] 1.6 Unit tests then code: `friendlyZodMessage` returns "Enter a tag name of 1 to 50 characters" for a `name` issue (existing branches unchanged), and `applyApiError` maps `TAG_NAME_TAKEN` to a `name` field error "You already have a tag with that name" and still returns null; with `fields = []` a `VALIDATION_ERROR` with details returns the generic message; verify with `pnpm --filter @todo/frontend test form-errors`
- [x] 1.7 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. New tag form: open, cancel, accessibility

`src/components/editor/NewTagForm.test.tsx` (rendered through `renderApp("/notes/<id>")`) - Requirement: New tag form
- [x] 2.1 Test "New tag opens the form"
- [x] 2.2 Test "Cancel closes the form without a request"
- [x] 2.3 Test "Reopened form starts empty"
- [x] 2.4 Test "New note cannot create tags yet"

Requirement: Tag form accessibility
- [x] 2.5 Test "Fields have accessible names"
- [x] 2.6 Test "Escape cancels"
- [x] 2.7 Implement `NewTagForm.tsx` (name input, colour input, **Create tag**, **Cancel**, form named "New tag", Escape handling) and wire it into `NoteTagPicker.tsx` (`creating` state, **New tag** button, focus to the name input on open and back to **New tag** on cancel, disabled button on `/notes/new`); submit does nothing yet; verify with `pnpm --filter @todo/frontend test NewTagForm` and that the existing `NoteEditorPage` tag tests pass unchanged
- [x] 2.8 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 3. Create and attach

`src/components/editor/NewTagForm.test.tsx` - Requirement: Create and attach a tag
- [x] 3.1 Test "Creating a tag adds it and attaches it"
- [x] 3.2 Test "Name is trimmed before sending"
- [x] 3.3 Test "Chosen colour is sent"
- [x] 3.4 Test "Creating refreshes tags and lists"
- [x] 3.5 Test "Created tag keeps unsaved edits"
- [x] 3.6 Test "Created tag on a clean note keeps the state clean"
- [x] 3.7 Test "Double submit sends one request"
- [x] 3.7a Test "Enter submits" (Requirement: Tag form accessibility)
- [x] 3.8 Extract `patchNoteTags` from `useToggleNoteTag` in `src/queries/note.ts` (behaviour unchanged; verify with the existing `useToggleNoteTag` and editor tag tests staying green), then implement `AttachAfterCreateError` and `useCreateNoteTag` (create, then attach, patch the note, invalidate the tags query and the lists)
- [x] 3.9 Submit handler in `NewTagForm` and `NoteTagPicker`: `zodResolver` form, in-flight guard (ref plus `isPending`), close the form and restore focus on success; verify the 3.1 to 3.7 tests pass
- [x] 3.10 Unit test: cancelling while the create is in flight still applies the result to the caches (the tag appears pressed); verify it passes
- [x] 3.11 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 4. Validation

`src/components/editor/NewTagForm.test.tsx` - Requirement: Tag name validation
- [ ] 4.1 Test "Blank name rejected in the browser"
- [ ] 4.2 Test "Overlong name rejected in the browser"
- [ ] 4.3 Test "Name of 50 characters is accepted"
- [ ] 4.4 Test "Duplicate name shows a field error"
- [ ] 4.5 Test "Same name in another case is sent"
- [ ] 4.6 Implement the inline name error (`aria-invalid`, `aria-describedby`, `role="alert"`), the 409 mapping through `applyApiError(error, setError, [])` and keeping the typed values; verify the 4.1 to 4.5 tests pass
- [ ] 4.7 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 5. Failures, session handling and docs

`src/components/editor/NewTagForm.test.tsx` - Requirement: Tag creation failures
- [ ] 5.1 Test "Server failure keeps the form"
- [ ] 5.2 Test "Unexpected validation error from the server"
- [ ] 5.3 Test "Network failure keeps the form"
- [ ] 5.4 Test "Attach failure after create"
- [ ] 5.5 Test "Attach on a deleted note"

Requirement: Session handling for tag creation (patterned on the AB-1010 session tests)
- [ ] 5.6 Test "Expired session on create"
- [ ] 5.7 Test "Expired token is refreshed once"
- [ ] 5.8 Implement the form-level alert for `POST /tags` failures and the partial-failure alert for `AttachAfterCreateError` (close the form, tags refreshed, tag unpressed, retry by pressing it); verify the 5.1 to 5.7 tests pass
- [ ] 5.9 Document the feature in `apps/frontend/CLAUDE.md` (an "AB-1018 tag creation" section: files, the create-then-attach mutation, the `AttachAfterCreateError` rule, the `TAG_NAME_TAKEN` mapping) and verify the text matches the code by reading the files it names
- [ ] 5.10 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 6. Integration check

- [ ] 6.1 Verify scenario coverage: every one of the 29 scenario names in `specs/frontend-tags/spec.md` appears as exactly one test title (`pnpm test` in `packages/repo-checks` for the scenario-to-test mapping, if it covers frontend titles; otherwise a grep) and `pnpm exec openspec validate ab-1018-tag-create-ui --strict` passes
- [ ] 6.2 Definition of done: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test --coverage` (new code at least 80%), no new `any`, `@ts-ignore` or `eslint-disable`
- [ ] 6.3 Manual smoke with the `run` skill: start Postgres, backend and frontend; register a user through the Vite proxy with curl, create a note, create a tag through the editor's request sequence with curl (`POST /tags`, `PUT /notes/{id}/tags/{tagId}`), check a duplicate name returns 409 and the list shows the tag with `noteCount` 1. No browser is available here; the browser journey belongs to AB-1016. Record what was checked

## Workflow follow-up

- Review `git diff main...HEAD` against this change in a fresh session (`/review ab-1018-tag-create-ui`), then `/create-pr`.
- At sync, add an AB-1018 row (FR-TAG-1, FR-FE-4) to `docs/FRS.md` section 4 and a line to the `docs/SDS.md` implementation status table.
- After merge: `/opsx:sync ab-1018-tag-create-ui`, then `/opsx:archive ab-1018-tag-create-ui`.
