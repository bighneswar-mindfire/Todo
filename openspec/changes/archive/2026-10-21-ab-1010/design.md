## Context

The backend is complete (AB-1002 to AB-1009). `apps/frontend` is a Vite + React 19 skeleton: `App.tsx` renders `<h1>Notes</h1>`, one Vitest test, coverage thresholds of 80% already configured. `@todo/shared` exports Zod 4 schemas from `dist/` (the frontend consumes the built package, so `pnpm build` order matters and is already handled by `pnpm -r build`).

Facts about the backend that shape this design:
- Tokens travel in the JSON body. `login` returns `{ accessToken, refreshToken, user }`; `refresh` returns only `{ accessToken, refreshToken }`; `register` returns `{ user }` and no tokens; `logout` and `reset-password` return 204; `forgot-password` returns 202 `{ message }`.
- Refresh tokens rotate and reuse of a revoked token revokes the user's whole token family. Two overlapping refresh calls with the same token therefore log the user out everywhere.
- There is no `GET /auth/me`, no CORS and no `/api` prefix. Access tokens live 15 minutes.
- `emailSchema` trims and lowercases, but its input and output types are both `string`, so it is safe to use as a form schema.

Library behaviour was verified with Context7 for react-router (data router: `createBrowserRouter`, `RouterProvider` from `react-router/dom`, everything else from `react-router`), TanStack Query v5 (`QueryClientProvider`, `useMutation`), Zustand v5 (`persist`, `createJSONStorage`, `partialize`, `getState` outside React; its docs warn that persisted data is not validated), shadcn/ui for Vite (Tailwind v4 via `@tailwindcss/vite`, `@/` alias, `cva` + `cn`), and `@hookform/resolvers` (`zodResolver` supports Zod 4; schemaOptions accepted).

## Goals / Non-Goals

**Goals**
- A foundation every later UI ticket reuses unchanged: providers, API client, session store, router with guards, UI primitives, test helpers.
- Auth flows that match the approved spec scenarios, with client validation taken from `@todo/shared` so rules cannot drift.
- Refresh handling that cannot trigger the backend's reuse-detection by accident.

**Non-Goals**
- Notes, tags, search, sharing, version UI (AB-1011+). Playwright E2E (AB-1016). Backend or Prisma changes. Production hosting or a production reverse proxy. Dark mode toggle, i18n, "remember me", change-password, an account page.

## Decisions

### D1. Module layout (feature-light, flat folders)

```
apps/frontend/src
  api/        client.ts  errors.ts  auth.ts  refresh.ts
  stores/     session.ts
  routes/     router.tsx  guards.tsx  NotFound.tsx
  pages/      LoginPage.tsx RegisterPage.tsx ForgotPasswordPage.tsx ResetPasswordPage.tsx HomePage.tsx
  components/ AppProviders.tsx  FormField.tsx  FormAlert.tsx  ui/{button,input,label,card,alert}.tsx
  lib/        utils.ts (cn)  query-client.ts  form-errors.ts
  test/       fake-api.ts  render.tsx
  index.css   main.tsx  App.tsx
```
Alternative: feature folders (`features/auth/...`). Rejected for now: one feature does not justify the nesting, and later tickets can move files cheaply. `main.tsx` stays untested (already excluded from coverage).

### D2. Router: react-router 8.5.0, data router, guards as layout components

`createBrowserRouter(routes)` rendered with `<RouterProvider>` from `react-router/dom`. `routes` is exported separately so tests build a `createMemoryRouter(routes, { initialEntries })`.

Guards are pathless layout routes rendering `<Outlet />` or `<Navigate />`:
- `RequireAuth`: signed out then `<Navigate to="/login" replace state={{ from: location }} />`.
- `RedirectIfAuthed`: signed in then `<Navigate to="/" replace />`.

Both read the session from Zustand reactively.
- **Alternative: route `loader` + `redirect()`.** Rejected: loaders run only on navigation. When a background refresh fails and clears the session, the user is on a page that did not navigate, so a loader would never fire. A reactive component guard redirects immediately, and it keeps the API client independent of the router (the client only clears the session).
- **Alternative: react-router 7.18.4.** 8.5.0 needs React >= 19.2.7 (repo has 19.3.1) and Node >= 22.22 (repo has 22.23.3), and its documented import split (`react-router` and `react-router/dom`) is the one we use. Exact pin, no range. If v8 breaks something at implement time, fall back to the 7.x line and record it.

Transient UI state (notice banners, prefilled email) travels in navigation `state`, not the URL: the email is not leaked into history, logs or referrers. It disappears on reload, which is acceptable for a one-time notice. After a successful login the app navigates to `state.from.pathname` (plus search) or `/`.

### D3. Session store: Zustand v5 `persist` with a validating storage

Shape: `{ session: AuthTokensResponse | null, setSession(s), setTokens(pair), clearSession() }`. `AuthTokensResponse` is the existing shared type (tokens + user), so no new schema. `isAuthenticated` is the selector `s.session !== null`, not stored state. Persisted under key `todo.session`, `version: 1`, `partialize` keeps only `session`.

The default `createJSONStorage` casts whatever `JSON.parse` returns (Zustand docs warn about this), and a corrupt value could crash the app on boot. So a small custom `PersistStorage` wraps `localStorage`: `getItem` catches JSON errors and runs `authTokensResponseSchema.nullable().safeParse(value.state.session)`; anything invalid returns `null` (signed out) and removes the bad key. `localStorage` access itself is wrapped in try/catch (private mode, blocked storage) and falls back to in-memory.

Hydration with `localStorage` is synchronous, so the first render already knows the session. No loading flash and no "hydrating" state. A `storage` event listener calls `useSession.persist.rehydrate()` so a login, refresh or logout in another tab is reflected here (this also keeps tabs from using a refresh token another tab already rotated).

- **Alternative: access token in memory only, refresh token in `localStorage`.** Slightly smaller XSS window for the access token, but every reload would force a refresh round-trip and the session shape gets split in two. Rejected for this ticket; revisit if a CSP/hardening ticket appears.
- **Alternative: httpOnly cookies.** Would be the safer option but needs backend changes and CORS/CSRF work; AB-1002 fixed tokens in the body. Out of scope.

### D4. API client: one `request()` core, typed endpoint functions

`api/client.ts` exposes `request<T>(path, { method, body, schema, auth, retryOn401 })`:
1. Build the URL with `new URL(API_BASE + path, window.location.origin)`. `API_BASE` is `/api` (overridable by `VITE_API_BASE`). The absolute URL is needed because Node's `fetch` in the jsdom test environment rejects relative URLs; browsers are unaffected.
2. Send JSON. For `auth: "bearer"` add `Authorization: Bearer <accessToken>` read with `useSession.getState()`.
3. `fetch` rejection becomes `ApiError { status: undefined, code: "NETWORK_ERROR" }`.
4. 204 resolves `undefined` without touching the body.
5. Non-2xx: parse the body with `errorResponseSchema`; on success build `ApiError(status, code, message, details)`. If the body is not a valid envelope (a 502 HTML page from a proxy, for example), `ApiError(status, "INTERNAL_ERROR", generic message)`.
6. 2xx: parse with the endpoint's response schema from `@todo/shared`; a mismatch is an `ApiError(status, "INTERNAL_ERROR")` rather than silently trusting the body.

`ApiError` is a class in `api/errors.ts`. Its `code` is `ErrorCode | ClientErrorCode`, where `ClientErrorCode` (`"NETWORK_ERROR"`) is added to `packages/shared` as `clientErrorCodeSchema` and type, to honour "types and schemas live only in shared". It is deliberately a separate enum: `errorCodeSchema` describes what the backend sends and stays untouched, and the approved `delta-openapi.yaml` already declares this client-only code.

Endpoint functions (`api/auth.ts`): `register`, `login`, `refresh`, `logout`, `forgotPassword`, `resetPassword`, each taking the shared request type and returning the shared response type.

Alternative: axios or ky. Rejected: no new dependency for ~80 lines, and `fetch` is already what the tests stub.

### D5. Silent refresh: single-flight, token-compare, one retry

In `request()`, when `retryOn401` is true (default for `auth: "bearer"`), a 401 triggers `refreshSession(failedAccessToken)` (in `api/refresh.ts`):

```
let inFlight: Promise<void> | null = null
async function refreshSession(failedToken) {
  const current = useSession.getState().session
  if (!current) throw sessionExpired            // signed out meanwhile
  if (current.accessToken !== failedToken) return // another call already refreshed; just retry
  inFlight ??= doRefresh().finally(() => { inFlight = null })
  await inFlight
}
```
`doRefresh` posts the stored refresh token to `/auth/refresh` (no Bearer, `retryOn401: false`), then `setTokens(pair)` keeping the stored user. On any failure it calls `clearSession()` and rethrows. The original request is retried exactly once with `retryOn401: false`; a second 401 clears the session and throws.

Why both the shared promise and the token comparison: the promise stops three simultaneous 401s from sending three refreshes; the comparison covers a late 401 that arrives after the shared promise already settled (it would otherwise rotate the token a second time, needlessly). Endpoints with `auth: "none"` (login and the other public calls) and `logout` (`retryOn401: false`, per the approved delta) never refresh.

Navigation after a failed refresh is not done by the client. `clearSession()` flips the store and `RequireAuth` redirects (D2). This keeps `api/` free of router imports and makes the behaviour testable without a router.

Known residual risk: two tabs refreshing in the same few milliseconds can still race and trip reuse detection. The `storage` sync (D3) makes this window small; a Web Locks cross-tab mutex would close it and is left as a follow-up, not built now.

### D6. Query client and cache hygiene

One `QueryClient` from `lib/query-client.ts`: `queries.retry` returns false for `ApiError` with status 400 to 499 and up to 2 retries otherwise; `mutations.retry: false`; `refetchOnWindowFocus` default. This ticket only uses `useMutation` (there are no GET queries yet); the client exists so AB-1011+ add queries without touching providers.

Cache clearing is attached to the session, not to a button: `AppProviders` subscribes to the store and calls `queryClient.clear()` whenever `session` goes from non-null to null (`useEffect` with cleanup, safe under StrictMode). Logout, failed refresh and a cross-tab logout therefore all clear the cache with no duplicated code, and a second user can never see the previous user's cached notes.

### D7. Forms: react-hook-form 7.90.0 + `zodResolver` with the shared schemas

Each form uses `useForm({ resolver: zodResolver(sharedSchema, { error: friendlyZodMessage }) })` and the page sends the parsed output to `api/auth.ts`. Because the shared schemas are the exact request schemas, "blocked on the client" and "rejected by the server" use the same rules.

- Zod's default messages ("Too small: expected string to have >=8 characters") are poor UI copy. `lib/form-errors.ts` supplies a Zod 4 error map keyed on issue code and field (email, "at least 8 characters", "6 digits"). The shared schemas stay message-free, so backend `details` text is unchanged. If `zodResolver`'s `schemaOptions.error` proves unsupported at implement time, map messages at render time from `issue.code` instead.
- Server errors: `ApiError.details` whose `field` matches a form field call `setError(field, { message })`; `EMAIL_TAKEN` sets the email field error; `INVALID_CREDENTIALS` and `INVALID_OTP` set a form-level error rendered in `<FormAlert role="alert">`; anything else (500, `NETWORK_ERROR`) shows "Something went wrong, please try again".
- Pending state: the submit button reads `mutation.isPending` and is disabled; RHF's own `isSubmitting` is not used so there is one source of truth.
- Mutations are `useMutation({ mutationFn })` calling the endpoint functions; navigation happens in `onSuccess`.
- Alternative: hand-rolled `useState` forms with `schema.safeParse`. Rejected: RHF already pairs with the Zod resolver and gives field-level error wiring; hand-rolling would reimplement it per page.

Messages shown: login "Invalid email or password"; reset "Invalid or expired code"; register-taken "Email already registered" (the spec and the tests pin this exact copy).

### D8. UI primitives: shadcn/ui, copied in, no CLI, no Radix

Tailwind CSS 4.3.3 via `@tailwindcss/vite` 4.3.3, `index.css` with `@import "tailwindcss"` and neutral CSS-variable tokens. `components/ui/` holds hand-copied shadcn-style `Button`, `Input`, `Label`, `Card`, `Alert` built on `class-variance-authority`, `clsx` and `tailwind-merge` (`cn`). A `components.json` is added so future tickets can run the shadcn CLI. The CLI is not run now because it would fetch unpinned latest packages and rewrite files (`@latest` is forbidden); copying the few components keeps every version pinned.

`Label` is a styled native `<label htmlFor>`, and Button does not use `asChild`, so `@radix-ui/*` is not added yet (add it in the ticket that needs a dialog or dropdown). Link-styled buttons use `buttonVariants` on react-router `<Link>`. No icon library for now.

Accessibility baseline: `FormField` renders label + input + error with `aria-invalid` and `aria-describedby`; form-level errors use `role="alert"`; the pending submit button is `disabled`.

Alias: `@` maps to `src` in both `vite.config.ts` (via `fileURLToPath(new URL("./src", import.meta.url))`, so `@types/node` is not needed) and `tsconfig.json` `paths`; Vitest reads the Vite alias.

### D9. Dev proxy

`vite.config.ts` defines one proxy object and applies it to both `server.proxy` and `preview.proxy`: `"/api"` to `http://localhost:3000`, `changeOrigin: true`, `rewrite: (p) => p.replace(/^\/api/, "")`. The rewrite function is exported (`apiProxyRewrite`) so the "dev proxy strips the prefix" scenario is a plain unit test on the real config value instead of a live server. The target port matches `apps/backend/.env.example` (`PORT=3000`).

Alternative: add `cors` to the backend. Rejected: it widens the backend surface for a dev-only problem and the spec promises no backend change. Production serving (static files plus real reverse proxy) is out of scope.

### D10. Test strategy (one named test per spec scenario)

- Runner: existing Vitest + jsdom + Testing Library; add `@testing-library/user-event` 14.6.8 for typing and clicking.
- HTTP: `test/fake-api.ts` stubs `globalThis.fetch` with a route table (`"POST /api/auth/login" -> handler`) that records calls, supports per-test responses and artificial delays (for the concurrent-401 and pending-button scenarios). No MSW: fewer dependencies and enough power for the scenarios.
- Unit tests: `api/client`, `api/refresh`, `stores/session`, `lib/form-errors`, proxy rewrite.
- Component tests: each page and the guards render through `createMemoryRouter(routes)` inside `AppProviders` via `test/render.tsx`, with a fresh `QueryClient` (`retry: false`) and a reset session store and `localStorage` per test.
- Scenarios for "Concurrent 401s refresh once" fire three `request()` calls with `Promise.all` against the fake API and assert one `/auth/refresh` hit.
- Coverage: 80% thresholds already enforced; `main.tsx` and `test-setup.ts` stay excluded.

### D11. Dependencies (exact pins, verified on the registry)

Runtime: `@tanstack/react-query` 5.104.5, `zustand` 5.0.15, `react-router` 8.5.0, `react-hook-form` 7.90.0, `@hookform/resolvers` 6.0.0 (peers: zod ^3.25 or ^4, RHF ^7.55; both satisfied), `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.7.0.
Dev: `tailwindcss` 4.3.3, `@tailwindcss/vite` 4.3.3, `@testing-library/user-event` 14.6.8.
`zod` is not added to the frontend: it comes through `@todo/shared`; the resolver peer is satisfied by the workspace copy, and the pnpm lockfile is checked for a single zod instance. If the resolver sees a different zod copy, `zod` 4.6.7 is added to the frontend at the same pin as shared.

## Risks / Trade-offs

- **Tokens in `localStorage` are readable by any XSS.** Accepted (D3). Mitigations: no `dangerouslySetInnerHTML`, user content rendered as text, a CSP as a later hardening item.
- **Cross-tab refresh race** (D5): reduced, not eliminated. The failure mode is a forced re-login, not data loss.
- **react-router 8 is new to us.** Pinned exactly, API usage restricted to the documented data-router surface; fallback to 7.18.4 if needed.
- **Refresh failure while a form is mid-submit** clears the session and redirects; unsaved form input is lost. Acceptable for auth forms; the notes editor ticket must handle drafts itself.
- **Persisted-session schema drift**: if `authTokensResponseSchema` changes, old stored sessions fail validation and the user simply logs in again (safe failure). `version: 1` with a `migrate` stub is in place for future changes.
- **Enumeration safety is only as good as the copy**: login and forgot-password messages must stay generic; tests pin the exact strings.
- **Sharing `dist/` of `@todo/shared`**: a stale `dist` makes the frontend type-check against old schemas. `pnpm build` rebuilds it first; documented in the tasks' checkpoint step.

## Open Questions

None blocking. Two choices to confirm at approval: (1) adding `clientErrorCodeSchema` to `packages/shared` (a two-line shared change, not a backend change), and (2) the hand-copied shadcn components instead of running the shadcn CLI.
