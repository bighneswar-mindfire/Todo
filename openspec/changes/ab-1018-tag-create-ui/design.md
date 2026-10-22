# Design

## Context

Frontend only. The backend (AB-1006) and the shared schemas (`createTagRequestSchema`, `tagSchema`, `tagRefSchema`) already exist. The editor's Tags group is `components/editor/NoteTagPicker.tsx`: `SavedNoteTags` renders one toggle per tag from `useTags()` and uses `useToggleNoteTag` (`queries/note.ts`), which patches `noteKeys.detail(noteId)` and calls `useInvalidateLists`. Forms in the app use react-hook-form with `zodResolver(sharedSchema, { error: friendlyZodMessage })` and `applyApiError` (`lib/form-errors.ts`). See proposal.md for scope and the assumptions this design builds on.

## Goals / Non-Goals

**Goals:**
- Reuse the existing toggle path for the attach, so a created tag behaves exactly like any other pressed tag.
- Reuse `Input`, `Label`, `Button`, `Alert` and the shared schemas; no new dependency.
- One test per spec scenario.

**Non-Goals:**
- No `packages/shared`, backend or dependency change.
- No tag management (rename, recolour, delete), no autocomplete, no colour palette.

## Decisions

**D1. Contract first, no schema changes.** `createTag(input: CreateTagRequest): Promise<Tag>` goes in `api/notes.ts` next to `listTags` and `attachTag`: it runs `createTagRequestSchema.parse(input)` (so the trim happens in the same place as `createNote`), then `request("/tags", { method: "POST", auth: "bearer", body, schema: tagSchema })`. The type parameter is `CreateTagRequest` from `@todo/shared`; its `color` is optional in the input type through the schema default, but the form always passes one. Alternative: a new `api/tags.ts`; rejected, the tags list call already lives in `api/notes.ts` and a one-function file adds nothing.

**D2. One mutation does create then attach.** `useCreateNoteTag(noteId)` in `queries/note.ts` has `mutationFn: async (input) => { const tag = await createTag(input); try { await attachTag(noteId, tag.id); } catch (error) { throw new AttachAfterCreateError(tag, error); } return tag; }`. `AttachAfterCreateError` is a small local class that carries the created tag, so the component can tell "create failed" (keep the form open, show the field or generic error) from "created, attach failed" (close the form, show the partial-failure alert) without guessing from the status code. The 404 on attach is not special: the spec gives it the same alert. Alternative: two chained `useMutation`s driven from the component; rejected, it moves ordering and partial-failure logic into the UI and makes the double-submit guard two guards.

**D3. Cache handling.** The note-tag patch in `useToggleNoteTag` is extracted into `patchNoteTags(queryClient, noteId, tag, attach)` and both mutations call it, so the cached note and the `aria-pressed` state come from one code path. `useCreateNoteTag` on success patches the note, invalidates `notesKeys.tags` and calls `useInvalidateLists`. On `AttachAfterCreateError` it invalidates `notesKeys.tags` only (the note did not change) so the tag shows unpressed. A failure of the `POST` invalidates nothing. The new tag appears pressed on the happy path because the picker derives `isAttached` from the cached note's `tags`, not from local state.

**D4. Form built like the auth forms.** `components/editor/NewTagForm.tsx` uses `useForm` with `zodResolver(createTagRequestSchema, { error: friendlyZodMessage })` over `{ name: "", color: "#6b7280" }` (the `DEFAULT_TAG_COLOR` constant from `@todo/shared`). `friendlyZodMessage` gets a `name` branch: "Enter a tag name of 1 to 50 characters" (Unit test). The name input has `maxLength` unset on purpose: a 51-character name must reach the schema so the spec's overlong scenario shows the message instead of the browser silently truncating a paste. The colour input is `type="color"`, which the browser guarantees to be `#rrggbb`, so the schema's colour rule never fires in practice. Alternative: uncontrolled inputs plus manual `safeParse`; rejected, it would add a second validation style next to the one every other form uses.

**D5. Server errors via `applyApiError`.** `applyApiError` gains `TAG_NAME_TAKEN` → `setError("name", { type: "server", message: "You already have a tag with that name" })`, the same way `EMAIL_TAKEN` is handled. The form calls it with an empty `fields` list, so a server `VALIDATION_ERROR` (not expected, the browser validated) never turns a server message into a field error and falls through to the generic alert, as the spec says. Alternative: a form-local `if (code === "TAG_NAME_TAKEN")`; rejected, it splits the error mapping across two places.

**D6. Where the form lives and how focus moves.** `SavedNoteTags` holds `creating: boolean`. While `creating` the **New tag** button is not rendered and `NewTagForm` is; the form's name input is focused in a mount effect. On success or Cancel, `creating` becomes false and a ref flag (`restoreFocusRef`) makes an effect focus the **New tag** button after it re-renders. Escape is handled in `onKeyDown` on the form. The unsaved-note branch of `NoteTagPicker` renders the same button with `disabled`. Alternative: a dialog like the share and delete dialogs; rejected, the spec asks for an inline form and a modal for one text field is heavy.

**D7. Partial-failure alert reuses the picker's `error` state.** `SavedNoteTags` already has `error` and a full-width destructive `Alert`. The attach-after-create failure sets it to "Tag created, but it could not be added to this note. Press it to try again" and closes the form. The existing `press` handler is the retry. The next toggle clears it, as today.

**D8. Single in-flight guard.** The submit handler returns early when a ref flag or `mutation.isPending` is set, and **Create tag** is `disabled` while pending (same pattern as `NoteEditor.savingRef` and the share dialog's `revokingRef`). **Cancel** stays enabled; if pressed while a create is in flight, the form closes and the result is still applied to the caches, so a late 201 attaches the tag and shows it pressed. Alternative: disable Cancel while pending; rejected, a stuck request would trap the user in the form.

**D9. Autosave and the dirty state are untouched.** The mutation never reads or writes editor state, so the autosave timer, the baseline and `useBlocker` behave as for a tag toggle.

**D10. Tests reuse the existing harness.** Tests use `renderApp("/notes/<id>")` with `fake-api.ts` routes (`GET /notes/:id`, `GET /tags`, `POST /tags`, `PUT /notes/:id/tags/:tagId`), and `makeFullNote` and `makeTag` from `test/fixtures.ts`; no fixture changes are expected beyond a `makeCreatedTag` helper if `makeTag` lacks `createdAt` (it is checked in task 1.1). The 401 scenarios follow the pattern in the AB-1010 session tests.

## Risks / Trade-offs

- [A tag is created but the attach fails, leaving an unattached tag] → by design and announced; pressing it retries. The tag is harmless and the list shows it.
- [Cancel during an in-flight create] → D8: the result still lands in the caches; the form is already closed, so the only visible effect is the pressed tag appearing. Covered by a Unit test.
- [A pasted 51+ character name is not truncated] → intended (D4); the user sees the error and can shorten it.
- [Duplicate names differing only by case are allowed] → matches the backend rule (case-sensitive); no client pre-check, so there is never a client and server disagreement.
- [Native colour input differs per browser] → the value is always `#rrggbb`; styling is minimal on purpose. Playwright (AB-1016) sets it with `fill`, which works in Chromium.
- [Touching `applyApiError` and `friendlyZodMessage`] → additive branches only; their existing tests must stay green and each new branch gets a Unit test.

## Migration Plan

None: no data, API or dependency change. Rollback is reverting the commits; tags already created remain valid.
