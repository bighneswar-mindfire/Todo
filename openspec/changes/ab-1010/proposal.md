## Why

The backend (AB-1002 to AB-1009) is complete but the frontend is a placeholder (`<h1>Notes</h1>`). Every later UI ticket (notes list, editor, tags, search, sharing, version history) needs the same base: server-state and client-state plumbing, an API client that attaches and refreshes tokens, routing with protected pages, and a signed-in session. This ticket builds that base and the auth screens, so a user can register, log in, recover a forgotten password, stay logged in across reloads and log out.

## What Changes

- **Frontend foundation** in `apps/frontend`: TanStack Query provider, a Zustand session store, shadcn/ui (Tailwind, Button, Input, Label, Card) and a client-side router. Added only now because this is the first ticket that needs them.
- **API client** (`src/api`): a typed `fetch` wrapper that validates request and response bodies with the Zod schemas from `@todo/shared` (no types redefined in the frontend), maps the backend error envelope to a typed `ApiError`, and attaches `Authorization: Bearer <accessToken>`.
- **Silent token refresh**: when an authenticated request returns 401, the client calls `POST /auth/refresh` once, stores the rotated pair and retries the original request once. Concurrent 401s share one in-flight refresh (rotation plus reuse detection would otherwise revoke the whole session). If refresh fails, the session is cleared and the user is sent to `/login`.
- **Session store** (Zustand, persisted to `localStorage`): `accessToken`, `refreshToken`, `user`. The session survives a page reload. There is no `GET /auth/me` endpoint, so the user comes from the login response.
- **Pages and routes**:
  - `/register`: email and password, then redirects to `/login` with a "account created" notice (register returns no tokens).
  - `/login`: email and password, then redirects to the page the user originally asked for, or `/`.
  - `/forgot-password`: email, then moves to `/reset-password` with the email prefilled and a hint that the OTP is printed in the server console (real email is out of scope).
  - `/reset-password`: email, 6-digit OTP, new password, then redirects to `/login` with a "password changed" notice.
  - `/` (protected): placeholder home showing the signed-in email and a **Log out** button. The notes UI comes in the next tickets.
  - Unauthenticated visits to protected routes go to `/login`. Authenticated visits to `/login`, `/register`, `/forgot-password`, `/reset-password` go to `/`.
- **Logout**: calls `POST /auth/logout` with the refresh token (best effort), then always clears the session and the TanStack Query cache and goes to `/login`.
- **Form validation** reuses the shared schemas (`registerRequestSchema`, `loginRequestSchema`, `forgotPasswordRequestSchema`, `resetPasswordRequestSchema`), so client and server rules cannot drift. Server errors are shown inline: `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `INVALID_OTP`, and per-field `VALIDATION_ERROR` details.
- **Dev connectivity**: the backend has no CORS and no `/api` prefix. The frontend calls `/api/*` and the Vite dev server proxies it to `http://localhost:3000` with the prefix stripped. No backend change.

Decisions fixed for this ticket:
- Tokens live in `localStorage` (the API returns them in the JSON body; cookies were ruled out in AB-1002). The XSS trade-off is accepted and noted in the plan.
- No auto-login after register; the user logs in explicitly.
- Login errors are generic, mirroring the backend: wrong password and unknown email show the same message.
- `forgot-password` always shows the same "if the account exists" confirmation (the backend returns an identical 202), so the UI cannot be used to enumerate accounts.
- Accessibility baseline: every input has a label, errors are announced (`role="alert"`), submit buttons are disabled while a request is pending.

## Capabilities

### New Capabilities
- `frontend-auth`: the frontend foundation and the authentication user experience (session, API client with refresh, routing guards, the four auth screens, logout).

### Modified Capabilities
None. No backend capability changes.

## Impact

- `apps/frontend`: new dependencies (exact versions pinned in the plan after Context7 verification): `@tanstack/react-query`, `zustand`, `react-router`, `react-hook-form` plus `@hookform/resolvers` (shadcn forms), Tailwind and shadcn/ui primitives (`class-variance-authority`, `clsx`, `tailwind-merge`, Radix slot/label). `vite.config.ts` gains the `/api` proxy and path alias. New `src/api`, `src/stores`, `src/routes`, `src/pages`, `src/components/ui`.
- `packages/shared`: no change expected. If a schema is missing for a form (for example a `reset-password` form-level confirm field), it is added here, never in the frontend.
- Backend, Prisma, migrations: no change.
- `delta-openapi.yaml`: declares **no new or changed endpoints**. It documents the existing auth endpoints this UI consumes and the status codes the UI handles, so the tests can be traced to the API contract.
- Out of scope: notes, tags, search, sharing and version UI (AB-1011+), "remember me", change password while logged in, OAuth, real email, auto-login after register, an account page, rate-limit handling, dark mode toggle, i18n, Playwright E2E (AB-1016).
