## Why

Every notes, tags, search, sharing and version endpoint (AB-1004 to AB-1009) must be scoped to an authenticated user. AB-1002 delivers the identity layer they depend on: account registration, login, logout and a JWT access token plus a rotating, DB-stored refresh token.

## What Changes

- `POST /auth/register`: create an account (email + password). Email is normalized to lowercase and unique; the password is stored only as a hash.
- `POST /auth/login`: verify credentials and return a 15-minute JWT access token and a 7-day opaque refresh token. Only a hash of the refresh token is stored in the `RefreshToken` table.
- `POST /auth/refresh`: exchange a valid refresh token for a new pair. Tokens rotate; presenting an already-revoked token revokes all of that user's refresh tokens (reuse detection).
- `POST /auth/logout`: requires a valid access token; revokes the supplied refresh token. Idempotent.
- Reusable `authenticate` middleware that verifies the Bearer access token and exposes the user id to later tickets.
- Shared Zod schemas and types for all auth requests, responses and the error envelope, in `packages/shared` only.
- Shared error envelope `{ "error": { "code", "message", "details"? } }` used by all endpoints from now on.
- New required env var `JWT_SECRET` (at least 32 characters); startup fails fast without it. `.env.example` is updated.

Decisions fixed for this ticket:
- The refresh token travels in the JSON body (no cookies, no CSRF surface).
- Registration returns the user only; the client then logs in.
- Password rule: 8 to 128 characters.
- Login failures return an identical 401 for unknown email and wrong password (no account enumeration).

## Capabilities

### New Capabilities
- `auth`: registration, login, token refresh with rotation, logout and access-token verification.

### Modified Capabilities
None.

## Impact

- Backend: new `/auth/*` routes, auth service, `authenticate` middleware, error-handling middleware and JWT config. No Prisma schema or migration change: `User` and `RefreshToken` from AB-1001 already cover this ticket.
- `packages/shared`: new auth schemas, types and error envelope.
- Env: `JWT_SECRET` added to `apps/backend/.env.example` and the env schema.
- Out of scope: forgot/reset password and OTP (AB-1003), auth UI (AB-1010), rate limiting, email verification, OAuth, cookie-based tokens, a `GET /auth/me` endpoint.
