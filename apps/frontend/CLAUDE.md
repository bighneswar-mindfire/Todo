# Frontend

React 19 + TypeScript + Vite. Auth UI and the app foundation exist (AB-1010); notes features start at AB-1011.

- Server state: TanStack Query. Client state: Zustand. Editor: TipTap. UI: shadcn/ui. Add each only in the ticket that needs it.
- Types and Zod schemas come from `@todo/shared`; never redefine API types here. `@todo/shared` is consumed from `dist/`, so run `pnpm --filter @todo/shared build` after changing it.
- Tests: Vitest + Testing Library (jsdom), files `src/**/*.test.tsx`. Playwright E2E arrives in AB-1016.
- Hooks rules are enforced by ESLint (`eslint-plugin-react-hooks`), zero warnings.

## AB-1010 foundation

- **Layout:** `api/` (client), `stores/session.ts`, `routes/` (router + guards), `pages/`, `components/` (`ui/` = hand-copied shadcn components, no CLI), `lib/`, `test/` (helpers).
- **API access:** all calls go through `api/client.ts` `request()` to the `/api` base path (`VITE_API_BASE` overrides). In dev and preview Vite proxies `/api/*` to `http://localhost:3000` and strips the prefix (`src/config/api-proxy.ts`); the backend has no CORS and no `/api` prefix. Add new endpoint functions next to `api/auth.ts`, typed with shared schemas.
- **Auth requests:** `auth: "bearer"` sends the access token. A 401 triggers one shared refresh (`api/refresh.ts`) and one retry; if the server rejects the refresh token the session is cleared. Never call `/auth/refresh` yourself and never refresh from a public endpoint.
- **Session:** `useSession` (Zustand `persist`, key `todo.session`) holds `{ accessToken, refreshToken, user }`, validated on load; read it outside React with `useSession.getState()`. `clearSession()` signs the user out everywhere: route guards redirect to `/login` and `AppProviders` clears the query cache.
- **Routing:** `routes/router.tsx` exports `routes`; `RequireAuth` guards protected pages, `RedirectIfAuthed` guards auth pages and sends signed-in users to the page they originally asked for. Transient UI state (notices, prefilled email) travels in navigation `state`, never the URL.
- **Forms:** react-hook-form + `zodResolver(sharedSchema, { error: friendlyZodMessage })`. Map server failures with `applyApiError`. Login and forgot-password messages must stay generic (no account enumeration).
- **Tests:** `test/fake-api.ts` stubs `fetch` (register routes as `route("POST /auth/login", ...)`, inspect `callsTo(...)`); `test/render.tsx` `renderApp(path | { pathname, state })` mounts the real routes in a memory router; `test/fixtures.ts` has `signIn()`. `test-setup.ts` resets the fake API, `localStorage` and the session before each test. One test per spec scenario, titled exactly as the scenario.

## AB-1011 notes list

- **Page:** `pages/NotesPage.tsx` is the protected `/` route (header with email and Log out, tag filter, list, pagination). Row components live in `components/notes/` (`NoteListItem`, `TagChip`, `TagFilter`, `PaginationBar`).
- **URL is the state:** `?page=&tagId=`. Read it with `parseListParams(searchParams)` and write it with `buildListParams({ page, tagId })` (`lib/list-params.ts`); bad values fall back to defaults, page 1 and no tag stay out of the URL. Page size is `PAGE_SIZE` (20).
- **Data:** `api/notes.ts` (`listNotes`, `listTags`) and `queries/notes.ts` (`useNotesList` with `keepPreviousData`, `useTags`, `notesKeys`). Later tickets that create, edit or delete a note invalidate `notesKeys.all` and `notesKeys.tags` (counts change).
- **Tests:** `routeEmptyNotes()` registers an empty `/notes` and `/tags` for any test that lands on `/`; `makeNote`, `makeTag`, `notesPage`, `deferred` are in `test/fixtures.ts`; `FakeCall.query` holds the request's `URLSearchParams`.
- Each row title is a `Link` to `/notes/<id>` (inside the row's `h2`); the header has a **New note** link to `/notes/new`.

## AB-1012 note editor

- **Routes:** `/notes/new` and `/notes/:id` (both `pages/NoteEditorPage.tsx`, under `RequireAuth`). The page owns the load states (loading, not found, retryable failure) and renders `components/editor/NoteEditor.tsx` with a key of `<id>:<revision>`, so switching notes remounts and resets all local state. After a create the key stays `new:<revision>` (`location.state.created`, a boolean; the editor keeps the new id in a ref), so the editor is not remounted and text typed during the `POST` is kept.
- **Layout:** `components/editor/` holds `NoteEditor` (title, Save, Delete, indicators), `RichTextEditor` (TipTap `useEditor`, StarterKit with `link` and `underline` off) and `Toolbar` (11 buttons, state via `useEditorState`), `NoteTagPicker`, `DeleteNoteDialog`, `DiscardChangesDialog`. `components/ui/dialog.tsx` is the hand-copied dependency-free modal (focus trap, Escape, focus restore).
- **Dirty rule:** baseline = `{ title, contentJson }`, where `contentJson` is captured from the editor in `onCreate` (TipTap normalises documents, so the server JSON is never compared). `dirty` is derived (`lib/note-diff.ts`: `diffNote`, `isDirty`, `contentKey`); typing the original value back is clean. After a save the baseline becomes the values that were sent.
- **Autosave (ab-1012-autosave):** `lib/autosave.ts` (`createAutosave`) debounces 1000 ms after each edit (`afterEdit` arms it only when dirty and the title is not blank), keeps one save in flight and queues one follow-up. Timer saves send `autosave: true` so the backend merges them into one version; **Save** and `Ctrl/Cmd+S` call `saveNow` (no flag, always a new version). The save logic reads the latest title, content and baseline from refs (updated with the state) because it runs from timers. A failure arms nothing: the next edit or **Retry** restarts saving. The timer is cancelled on unmount and delete; a restore remounts the editor.
- **Guard:** `useBlocker` blocks only when dirty and the pathname changes; on `blocked` the editor `flush`es the pending save and proceeds, and shows the discard dialog only if that fails or the title is blank. `bypassRef` is set just before the navigation after create (and reset right after) and after delete. `beforeunload` is registered only while dirty.
- **Tags and delete:** tag toggles go straight to `PUT`/`DELETE /notes/{id}/tags/{tagId}` and never touch the dirty state. Delete is a soft delete; a 404 counts as success.
- **Cache:** `queries/note.ts` (`noteKeys.detail`, `useNote` with `staleTime: 30_000`, `useSaveNote`, `useDeleteNote`, `useToggleNoteTag`). Mutations invalidate `notesKeys.lists` and `notesKeys.tags`, never `notesKeys.all`, because that prefix would also refetch the detail query that was just seeded.
- **Tests:** autosave component tests live in `pages/NoteEditorAutosave.test.tsx` (fake timers with `shouldAdvanceTime`, `advance(ms)` jumps the clock). `makeFullNote`, `doc`, `paragraph` in `test/fixtures.ts`; `test-setup.ts` shims the layout APIs ProseMirror needs under jsdom. In tests TipTap exposes its instance as `textbox.editor` (use it to set a selection or insert content). React Router commits navigation in a transition: after `router.state` changes, wait for the new page (for example its heading) before typing.
