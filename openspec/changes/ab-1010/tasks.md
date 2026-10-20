## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command (`$env:Path = "$env:APPDATA\fnm\node-versions\v22.23.3\installation;" + $env:Path`).
- Model per task: Haiku = boilerplate, Sonnet = implementation. No Opus task (design.md is approved).
- No task is estimated over 45 minutes, so no subagent is needed. `[PARALLEL]` marks tasks that touch separate files and can run in separate worktrees.
- Test files hold one test per scenario, titled exactly as the scenario. 47 scenarios, 47 test tasks (15 in section 2, 6 in section 3, 26 in section 4).
- Frontend tests stub `fetch` through `src/test/fake-api.ts` (no MSW). Each test resets the session store, `localStorage` and the fake API.
- `@todo/shared` is consumed from `dist/`: run `pnpm --filter @todo/shared build` after any shared change before frontend checks.
- Exact version pins from design.md D11. Verify any API not yet confirmed (react-hook-form `zodResolver` `schemaOptions.error`, Zustand custom `PersistStorage`) with Context7 before coding.
- One commit per phase after its checkpoint: `feat(frontend): description AB#1010`.

## 1. Foundation: shared, dependencies, config, UI primitives

- [x] 1.1 Add `clientErrorCodeSchema` (`z.enum(["NETWORK_ERROR"])`) and `ClientErrorCode` type to `packages/shared/src/auth.ts` (not to `errorCodeSchema`); add a shared test; rebuild shared (Haiku)
- [x] 1.2 Add pinned dependencies to `apps/frontend/package.json` and install: `@tanstack/react-query` 5.104.5, `zustand` 5.0.15, `react-router` 8.5.0, `react-hook-form` 7.90.0, `@hookform/resolvers` 6.0.0, `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.7.0; dev `tailwindcss` 4.3.3, `@tailwindcss/vite` 4.3.3, `@testing-library/user-event` 14.6.8. Confirm a single zod instance in the lockfile (Haiku)
- [x] 1.3 Create `src/config/api-proxy.ts` (`API_PROXY_TARGET`, exported `apiProxyRewrite`, shared `apiProxy` object); update `vite.config.ts`: `@tailwindcss/vite` plugin, `@` alias via `fileURLToPath`, `server.proxy` and `preview.proxy` (Sonnet)
- [x] 1.4 [PARALLEL] Update `tsconfig.json` `paths` for `@/*`; add `components.json`; create `src/index.css` (`@import "tailwindcss"` plus neutral CSS-variable tokens) and import it in `main.tsx`; set `index.html` title (Haiku)
- [x] 1.5 [PARALLEL] Create `src/lib/utils.ts` (`cn`) and `src/components/ui/{button,input,label,card,alert}.tsx` (shadcn-style, `cva` variants, no Radix) (Haiku)
- [x] 1.6 [PARALLEL] Create `src/test/fake-api.ts` (route table, call log, per-route delay, reset) and `src/test/render.tsx` (`renderApp(path, opts)` with `createMemoryRouter(routes)` inside `AppProviders`, fresh `QueryClient` with `retry: false`) (Sonnet)
- [x] 1.7 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. Core: errors, API client, session store, refresh

- [x] 2.1 Verify Zustand v5 custom `PersistStorage` (`getItem` returning `StorageValue` or `null`, `setItem`, `removeItem`) with Context7 before coding (Sonnet)
- [x] 2.2 Create `src/stores/session.ts`: `useSession` with `session`, `setSession`, `setTokens`, `clearSession`; validating `PersistStorage` over `localStorage` (try/catch, in-memory fallback, `authTokensResponseSchema.nullable()`, bad key removed); `partialize`, `version: 1`; `selectIsAuthenticated`; `storage` event listener calling `persist.rehydrate()` (Sonnet)
- [x] 2.3 [PARALLEL] Create `src/api/errors.ts` (`ApiError` with `status`, `code: ErrorCode | ClientErrorCode`, `message`, `details`) (Haiku)
- [x] 2.4 Create `src/api/client.ts`: `request()` per design D4 (absolute URL from `API_BASE` default `/api`, JSON body, Bearer from store, `NETWORK_ERROR`, 204 handling, error-envelope and response-schema parsing, `INTERNAL_ERROR` fallback) (Sonnet)
- [x] 2.5 Create `src/api/refresh.ts` (`refreshSession`, single-flight promise, token-compare, `clearSession` on failure) and wire `retryOn401` single retry into `request()` (Sonnet)
- [x] 2.6 Create `src/api/auth.ts`: `register`, `login`, `refresh`, `logout` (`retryOn401: false`), `forgotPassword`, `resetPassword` typed with shared schemas (Sonnet)

`src/api/client.test.ts` - Requirement: API client
- [x] 2.7 Test "Bearer token attached"
- [x] 2.8 Test "Public requests carry no token"
- [x] 2.9 Test "Error envelope becomes ApiError"
- [x] 2.10 Test "Validation details preserved"
- [x] 2.11 Test "Network failure is reported"
- [x] 2.12 Test "Empty success response"

`src/stores/session.test.ts` - Requirement: Session store and persistence
- [x] 2.13 Test "Session set after login"
- [x] 2.14 Test "Session restored after reload" (re-import the module with `vi.resetModules`)
- [x] 2.15 Test "Corrupt persisted session ignored" (invalid JSON and schema-invalid value)
- [x] 2.16 Test "Clear session"

`src/api/refresh.test.ts` - Requirement: Silent token refresh
- [x] 2.17 Test "Expired access token refreshed transparently"
- [x] 2.18 Test "Concurrent 401s refresh once" (three `Promise.all` requests, one `/auth/refresh` hit)
- [x] 2.19 Test "Failed refresh signs the user out"
- [x] 2.20 Test "Retry is not repeated"
- [x] 2.21 Test "Public endpoints never trigger refresh"
- [x] 2.22 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 3. App shell: providers, router, guards, form helpers

- [ ] 3.1 Verify react-router 8.5.0 imports (`createBrowserRouter`, `createMemoryRouter`, `Navigate`, `Outlet`, `Link`, `useNavigate`, `useLocation` from `react-router`; `RouterProvider` from `react-router/dom`) and `zodResolver` `schemaOptions.error` with Context7 before coding (Sonnet)
- [ ] 3.2 Create `src/lib/query-client.ts` (retry policy per D6) and `src/components/AppProviders.tsx` (`QueryClientProvider`; `useEffect` subscribing to the session store and calling `queryClient.clear()` on signed-in to signed-out, with cleanup) (Sonnet)
- [ ] 3.3 [PARALLEL] Create `src/lib/form-errors.ts` (Zod 4 error map to friendly copy; `applyApiError(error, setError)` mapping `details`, `EMAIL_TAKEN`, form-level codes) (Sonnet)
- [ ] 3.4 [PARALLEL] Create `src/components/FormField.tsx` (label, input, error, `aria-invalid`, `aria-describedby`) and `src/components/FormAlert.tsx` (`role="alert"`) (Haiku)
- [ ] 3.5 Create `src/routes/guards.tsx` (`RequireAuth`, `RedirectIfAuthed`), `src/routes/NotFound.tsx`, and `src/routes/router.tsx` exporting `routes` and `createAppRouter()`; replace `App.tsx` with `RouterProvider` inside `AppProviders`, update `main.tsx` and the existing `App.test.tsx` (Sonnet)
- [ ] 3.6 Create placeholder page modules so routes compile (replaced in section 4) (Haiku)

`src/routes/guards.test.tsx` - Requirement: Route protection
- [ ] 3.7 Test "Signed-out visitor redirected to login"
- [ ] 3.8 Test "Return to requested page after login" (needs 4.2; written here, runs green after section 4)
- [ ] 3.9 Test "Signed-in user skips auth pages"
- [ ] 3.10 Test "Unknown route"

`src/config/api-proxy.test.ts` and `src/foundation.test.tsx` - Requirement: Foundation and accessibility baseline
- [ ] 3.11 Test "Dev proxy strips the prefix" (on `apiProxy["/api"].rewrite` and the object used by `vite.config.ts`)
- [ ] 3.12 Test "Providers mounted" (a probe component using `useMutation`, `useQueryClient` and `useSession`)
- [ ] 3.13 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test` (3.8 may be marked pending until section 4; it must be green at 4.x)

## 4. Pages

- [ ] 4.1 [PARALLEL] Create `src/pages/RegisterPage.tsx`: RHF + `zodResolver(registerRequestSchema)`, `useMutation(register)`, navigate to `/login` with notice state, inline and form errors, pending-disabled submit (Sonnet)
- [ ] 4.2 [PARALLEL] Create `src/pages/LoginPage.tsx`: `loginRequestSchema`, `setSession` on success, navigate to `state.from` or `/`, generic `INVALID_CREDENTIALS` alert, notice banner from navigation state (Sonnet)
- [ ] 4.3 [PARALLEL] Create `src/pages/ForgotPasswordPage.tsx`: `forgotPasswordRequestSchema`, generic confirmation, navigate to `/reset-password` with `{ email }` state, console hint text (Sonnet)
- [ ] 4.4 [PARALLEL] Create `src/pages/ResetPasswordPage.tsx`: `resetPasswordRequestSchema`, email prefilled from state, `INVALID_OTP` alert "Invalid or expired code" keeping fields, navigate to `/login` with notice (Sonnet)
- [ ] 4.5 [PARALLEL] Create `src/pages/HomePage.tsx`: shows `session.user.email`, Log out button calling `logout` (best effort) then `clearSession()` and navigating to `/login` (Sonnet)

`src/pages/RegisterPage.test.tsx` - Requirement: Registration screen
- [ ] 4.6 Test "Successful registration"
- [ ] 4.7 Test "Invalid email blocked on the client"
- [ ] 4.8 Test "Short password blocked on the client"
- [ ] 4.9 Test "Email already taken"
- [ ] 4.10 Test "Server validation details shown per field"
- [ ] 4.11 Test "Submit disabled while pending"

`src/pages/LoginPage.test.tsx` - Requirement: Login screen
- [ ] 4.12 Test "Successful login"
- [ ] 4.13 Test "Wrong credentials"
- [ ] 4.14 Test "Same message for unknown email"
- [ ] 4.15 Test "Empty fields blocked on the client"
- [ ] 4.16 Test "Unexpected server error"
- [ ] 4.17 Test "Notice after registration"

`src/pages/ForgotPasswordPage.test.tsx` - Requirement: Forgot password screen
- [ ] 4.18 Test "Request accepted"
- [ ] 4.19 Test "Same outcome for unknown email"
- [ ] 4.20 Test "Malformed email blocked"
- [ ] 4.21 Test "Console hint visible"

`src/pages/ResetPasswordPage.test.tsx` - Requirement: Reset password screen
- [ ] 4.22 Test "Successful reset"
- [ ] 4.23 Test "Non-numeric OTP blocked"
- [ ] 4.24 Test "Short new password blocked"
- [ ] 4.25 Test "Invalid or expired OTP"
- [ ] 4.26 Test "Email prefilled from previous step"

`src/pages/HomePage.test.tsx` - Requirement: Logout
- [ ] 4.27 Test "Logout revokes and clears" (also asserts query cache cleared)
- [ ] 4.28 Test "Logout succeeds locally when the API fails"
- [ ] 4.29 Test "Home shows the signed-in user"

`src/foundation.test.tsx` (continued) - Requirement: Foundation and accessibility baseline
- [ ] 4.30 Test "Labelled inputs" (all four auth pages, inputs found by label text)
- [ ] 4.31 Test "Errors announced" (form-level error rendered with `role="alert"`)
- [ ] 4.32 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage` (thresholds 80%); 3.8 is now green

## 5. Docs and end-to-end sanity

- [ ] 5.1 Update `apps/frontend/CLAUDE.md`: structure, `/api` proxy and `VITE_API_BASE`, session store and refresh rules, test helpers (Haiku)
- [ ] 5.2 Manual smoke with the `run` skill: start Postgres and backend, `pnpm --filter @todo/frontend dev`, register, log in, reload (session persists), forgot/reset using the OTP from the backend console, log out; note results in the PR description (Sonnet)
- [ ] 5.3 Scenario audit: confirm every one of the 47 scenario titles in `specs/frontend-auth/spec.md` has exactly one test with that exact name (grep script or manual list) (Haiku)
- [ ] 5.4 Final checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage`
