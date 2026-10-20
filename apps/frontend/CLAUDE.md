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
