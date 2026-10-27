# Frontend

React 19 + TypeScript + Vite. Specs and routes: `openspec/specs/` and `docs/SDS.md` section 6; this file holds the rules that the code alone does not show.

- Server state: TanStack Query. Client state: Zustand. Editor: TipTap. UI: shadcn/ui. Add each only when a spec needs it.
- Types and Zod schemas come from `@todo/shared`; never redefine API types here. `@todo/shared` is consumed from `dist/`, so run `pnpm --filter @todo/shared build` after changing it.
- Hooks rules are enforced by ESLint (`eslint-plugin-react-hooks`), zero warnings.

## Layout

- `api/` (client and endpoint functions), `queries/` (TanStack hooks and keys), `stores/` (`session.ts`), `routes/` (router and guards), `pages/`, `components/` (grouped by feature: `editor/`, `notes/`, `trash/`, `search/`, `share/`, `versions/`; `ui/` = hand-copied shadcn components, no CLI), `hooks/` (generic React hooks such as `useDebouncedCallback`), `lib/` (pure helpers), `config/`, `test/` (helpers).
- Pages own load states (loading, not found, retryable failure); components render data they are given.

## API access and auth

- All HTTP goes through `api/client.ts` `request()` to the `/api` base path (`VITE_API_BASE` overrides). In dev and preview Vite proxies `/api/*` to `http://localhost:3000` and strips the prefix (`src/config/api-proxy.ts`); the backend has no CORS and no `/api` prefix.
- Add endpoint functions next to `api/auth.ts` / `api/notes.ts`, typed and validated with shared schemas.
- `auth: "bearer"` sends the access token. A 401 triggers one shared refresh (`api/refresh.ts`) and one retry; if the server rejects the refresh token the session is cleared. Never call `/auth/refresh` yourself and never refresh from a public endpoint.
- The 401 flows of every protected page come from `api/client.ts`; a page needs no code of its own for them.

## Session and routing

- `useSession` (Zustand `persist`, key `todo.session`) holds `{ accessToken, refreshToken, user }`, validated on load; read it outside React with `useSession.getState()`. `clearSession()` signs the user out everywhere: route guards redirect to `/login` and `AppProviders` clears the query cache.
- `routes/router.tsx` exports `routes`. `RequireAuth` guards protected pages; `RedirectIfAuthed` guards auth pages and sends signed-in users to the page they originally asked for.
- Routes: `/` notes list, `/search`, `/trash`, `/notes/new` and `/notes/:id` editor (all behind `RequireAuth`); the auth pages (`/login`, `/register`, `/forgot-password`, `/reset-password`) behind `RedirectIfAuthed`; the public `/shared/:token` (`SharedNotePage`); `*` is `NotFound`. Transient UI state (notices, prefilled email) travels in navigation `state`, never the URL.

## URL state and lists

- The URL holds list state: `?page=&tagId=`. Read it with `parseListParams(searchParams)` and write it with `buildListParams({ page, tagId })` (`lib/list-params.ts`); bad values fall back to defaults, page 1 and no tag stay out of the URL. Page size is `PAGE_SIZE` (20).
- List pages (notes, trash) share `PaginationBar`, a past-the-end fallback to the last page and a Retry alert. The trash page ignores the `tagId` the parser also reads.
- Notes rows link to `/notes/<id>` (inside the row's `h2`). Trash rows are plain text, not links: the API answers 404 for a deleted note, and a trash summary carries no tags.

## Data (TanStack Query)

- Keys live next to their hooks: `notesKeys` and `trashKeys` in `queries/notes.ts`, `noteKeys` in `queries/note.ts`. `trashKeys` sits under `["notes"]` but outside `["notes", "list"]`, and stays in `queries/notes.ts` so `queries/note.ts` can import it without a cycle.
- Mutations that change a note invalidate `notesKeys.lists` and `notesKeys.tags` (counts change) through `useInvalidateLists`, never `notesKeys.all`: that prefix would also refetch the detail query that was just seeded or patched. Deleting also invalidates `trashKeys.all`; restoring filters the id out of the cached trash pages, seeds `noteKeys.detail` and invalidates the lists.
- `useNote` uses `staleTime: 30_000`; `useNotesList` uses `keepPreviousData`.
- A per-row mutation hook (`useRestoreNote`) is called once per row so `isPending` is per row. The row awaits `mutateAsync` and reports through callbacks, because `mutate` callbacks do not fire once the row has unmounted.
- On a failed mutation re-fetch what the server decides (invalidate) instead of guessing the cache.

## Forms and errors

- react-hook-form + `zodResolver(sharedSchema, { error: friendlyZodMessage })`. `friendlyZodMessage` words the field messages.
- Map server failures with `applyApiError(error, setError, fields)`: known codes (for example 409 `TAG_NAME_TAKEN`) become field errors; everything else, including a server `VALIDATION_ERROR` when `fields` is empty, becomes the generic alert.
- Login and forgot-password messages stay generic (no account enumeration).
- Do not set `maxLength` on inputs whose limit the schema owns, so an overlong paste reaches the schema and shows its message. Never pre-check uniqueness in the browser.
- Guard double submit with `isPending` plus a ref in the form. The colour input is the native `type="color"` with `defaultValue` set explicitly (react-hook-form alone left jsdom at `#000000`).

## Editor

- Routes `/notes/new` and `/notes/:id` both render `pages/NoteEditorPage.tsx`, which renders `components/editor/NoteEditor.tsx` with a key of `<id>:<revision>`, so switching notes remounts and resets local state. After a create the key stays `new:<revision>` (`location.state.created`, a boolean; the editor keeps the new id in a ref), so text typed during the `POST` is kept.
- Parts: `NoteEditor` (title, Save, Delete, indicators), `RichTextEditor` (TipTap `useEditor`, StarterKit with `link` and `underline` off), `Toolbar` (state via `useEditorState`), `NoteTagPicker`, `NewTagForm`, `DeleteNoteDialog`, `DiscardChangesDialog`. `components/ui/dialog.tsx` is the dependency-free modal (focus trap, Escape, focus restore).
- **Dirty rule:** baseline = `{ title, contentJson }`, where `contentJson` is captured from the editor in `onCreate` (TipTap normalises documents, so the server JSON is never compared). `dirty` is derived (`lib/note-diff.ts`: `diffNote`, `isDirty`, `contentKey`); typing the original value back is clean. After a save the baseline becomes the values that were sent.
- **Autosave:** `lib/autosave.ts` (`createAutosave`) debounces 1000 ms after each edit (`afterEdit` arms it only when dirty and the title is not blank), keeps one save in flight and queues one follow-up. Timer saves send `autosave: true` so the backend merges them into one version; **Save** and `Ctrl/Cmd+S` call `saveNow` (no flag, always a new version). The save logic reads the latest title, content and baseline from refs because it runs from timers. A failure arms nothing: the next edit or **Retry** restarts saving. The timer is cancelled on unmount and delete; a restore remounts the editor.
- **Navigation guard:** `useBlocker` blocks only when dirty and the pathname changes; on `blocked` the editor `flush`es the pending save and proceeds, and shows the discard dialog only if that fails or the title is blank. `bypassRef` is set just before the navigation after create (and reset right after) and after delete. `beforeunload` is registered only while dirty.
- **Tags and delete:** tag toggles go straight to `PUT`/`DELETE /notes/{id}/tags/{tagId}` and never touch the dirty state. Delete is a soft delete; a 404 counts as success.
- **Creating a tag:** the **New tag** button opens `NewTagForm` inline (disabled on `/notes/new` with the rest of the group); focus goes to the name input on open and back to the button on close. `useCreateNoteTag(noteId, onAttachFailed)` calls `createTag` then `attachTag` and patches the cached note with `patchNoteTags` (shared with `useToggleNoteTag`). If only the attach fails it throws `AttachAfterCreateError`, invalidates the tags query and calls `onAttachFailed` (a hook option so it still runs after the form closes); the picker shows "Tag created, but it could not be added to this note. Press it to try again".
- **Trash and restore:** `pages/TrashPage.tsx` and `components/trash/TrashListItem.tsx`. One page-level alert: 404 "That note can't be restored", anything else "Couldn't restore that note. Try again"; cleared by a successful restore or a page change. No confirm dialog and no permanent delete.

## Tests

- Vitest + Testing Library (jsdom), files `src/**/*.test.tsx`; one test per spec scenario, titled exactly as the scenario. Playwright E2E lives in `apps/e2e` (`pnpm test:e2e`; see its README).
- `test/fake-api.ts` stubs `fetch` (register routes as `route("POST /auth/login", ...)`, inspect `callsTo(...)`; `FakeCall.query` holds the request's `URLSearchParams`). `test/render.tsx` `renderApp(path | { pathname, state })` mounts the real routes in a memory router. `test/fixtures.ts` has `signIn()`, `makeNote`, `makeFullNote`, `makeTag`, `notesPage`, `deferred`, `doc`, `paragraph`. `test-setup.ts` resets the fake API, `localStorage` and the session before each test and shims the layout APIs ProseMirror needs under jsdom.
- Helpers for common setups: `routeEmptyNotes()` (empty `/notes` and `/tags` for any test that lands on `/`), `serveCreate()` (makes `GET /tags` list what `POST /tags` created), `serveRestorable()` (a live trash list that `POST /notes/{id}/restore` removes from).
- Test pages through `renderApp`, not by mounting components alone. Autosave tests use fake timers with `shouldAdvanceTime` (`pages/NoteEditorAutosave.test.tsx`, `advance(ms)` jumps the clock).
- In tests TipTap exposes its instance as `textbox.editor` (use it to set a selection or insert content). React Router commits navigation in a transition: after `router.state` changes, wait for the new page (for example its heading) before typing. Set colour inputs with `fireEvent.change` (userEvent cannot type into a colour input).
