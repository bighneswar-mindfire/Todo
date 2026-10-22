# Proposal

## Why

Ticket AB-1018 implements FR-TAG-1 (create a tag) from the user's side, inside the note editor of FR-FE-4 (`docs/FRS.md` sections 2.5 and 2.7). The backend (AB-1006) already creates tags with `POST /tags`, and the editor can attach and detach existing tags, but the app has no way to make a tag: a new user sees "No tags yet" with nothing to press, and the tag filter on the list stays empty. AB-1012 left this out on purpose. The Playwright journey (AB-1016) also needs it ("tag" step) without seeding tags through the API.

## What Changes

- **New tag control in the editor's Tags group** (saved notes). A **New tag** button opens an inline form under the tag buttons with a name input, a colour input and **Create tag** and **Cancel** buttons.
- **Create and attach in one action.** Submitting sends `POST /tags` with `{ name, color }` and, on 201, `PUT /notes/{id}/tags/{tagId}` for the open note. The new tag then shows as a pressed toggle. Creating never touches the title or content, never counts as an unsaved change and never sends `PATCH`, like the existing toggles.
- **Validation in the browser** with the shared `createTagRequestSchema`: a blank or 51+ character name is rejected with an inline message and no request. The colour defaults to `#6b7280` and always matches `#RRGGBB` because it comes from a native colour input.
- **Server failures mapped to the form.** 409 `TAG_NAME_TAKEN` becomes a field error on the name; other failures show an alert and keep the form and what was typed. If the tag is created but attaching fails, the tag stays in the list, unpressed, with an alert saying so.
- **API function and cache.** `createTag` joins `listTags` in `api/notes.ts`, validated with the shared schemas. A successful create refreshes the tags query (so the list filter and counts update) and patches the cached note's tags.
- **`/notes/new`**: the New tag button is disabled together with the rest of the Tags group ("Save the note to add tags").
- **Out of scope**: backend, database, `packages/shared` and dependency changes; renaming, recolouring or deleting tags (FR-TAG-3, FR-TAG-4 UI); creating tags from the notes list, the search page or an unsaved note; tag autocomplete or search inside the picker; a colour palette or swatches beyond the native colour input; a "create without attaching" option; trash UI and the Playwright journey (AB-1016); button colour (AB-1017).

Decisions assumed (no user answer needed, change them at the gate if wrong): creating from a note also attaches the tag, because someone who types a new tag there wants it on that note; the entry point is only the editor's Tags group; colour uses the native `<input type="color">` (no new dependency, always valid `#RRGGBB`); names are case-sensitive as the backend defines, so "work" and "Work" are different tags and the browser does not pre-check duplicates; the form is hidden until **New tag** is pressed and closes after a successful create.

Rollback: remove the New tag button and form from the Tags group and the `createTag` function. No data or API is touched; tags already created stay valid and usable through the existing toggles.

Docs follow-up (at sync, not part of this change's code): `docs/FRS.md` section 4 has no AB-1018 row; it should map AB-1018 to FR-TAG-1 and FR-FE-4.

## Capabilities

### New Capabilities
- `frontend-tags`: creating a tag from the note editor (the New tag form, validation, create and attach, failure handling, session handling, accessibility) and the `createTag` API function with its cache refresh.

### Modified Capabilities
<!-- None. The existing "Tags on a note" requirement in frontend-note-editor stays true as written: "No tags yet" and the disabled state on /notes/new are unchanged, and New tag is added beside them. -->

## Impact

- Frontend only: `apps/frontend/src/api/notes.ts` (`createTag`), `src/queries/note.ts` (`useCreateTag`), `src/components/editor/NoteTagPicker.tsx` and a new `NewTagForm.tsx`, `src/test/fixtures.ts` (`makeTag` reuse), tests.
- No change to `packages/shared`, the backend, Prisma or dependencies. `delta-openapi.yaml` has empty `paths` and records how the UI reacts to `POST /tags` and the attach call.
- Existing `frontend-note-editor` scenarios for the Tags group must stay green unchanged.
