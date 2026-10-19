## Context

AB-1003 adds password recovery to the AB-1002 auth module: `POST /auth/forgot-password` and `POST /auth/reset-password`. The `PasswordResetOtp` table (`otpHash`, `attempts`, `expiresAt`, `usedAt`) already exists, so there is no migration. Real email is out of scope; the OTP is logged to the console.

**Goals**
- Account recovery with a 6-digit OTP (10 min TTL, 5 attempts, single use), stored hashed.
- No account enumeration through response bodies or statuses.
- A successful reset atomically changes the password, consumes the OTP and revokes all sessions.
- Every spec scenario has exactly one named test, against the real Postgres.

**Non-Goals**
- Rate limiting or cooldown on `forgot-password`.
- Timing equalization between known and unknown email on `forgot-password` (a small DB-write timing gap remains).
- Purging old OTP rows, issuing tokens on reset, real email, auth UI (AB-1010).

## Decisions

### D1. OTP generation
`crypto.randomInt(0, 1_000_000)` zero-padded to 6 digits. CSPRNG, uniform (verified against Node 22 docs in Context7).

### D2. OTP hash
`HMAC-SHA256(key = JWT_SECRET, msg = "password-reset-otp:" + userId + ":" + otp)`, hex. A leaked DB alone cannot brute-force the 10^6 space without the server secret, and no new env var is needed. The domain prefix keeps this use of the secret separate from JWT signing. Comparison uses `timingSafeEqual` on equal-length buffers.

### D3. Issue (`forgotPassword`)
Email is normalized by the shared schema. Unknown email: same 202 body, no row, no log. Known email: one transaction that locks the user row (`SELECT ... FOR UPDATE`, as `refresh` does), `updateMany` unused OTPs to `usedAt = now`, then creates the new row (`attempts` 0, `expiresAt = now + 10 min`). The code is passed to the sender only after commit.

### D4. Reset (`resetPassword`)
1. Shared Zod validation first, so a weak password or malformed OTP never touches or consumes an OTP.
2. Hash `newPassword` before any lookup, always (also for unknown emails), so response time does not reveal whether the account exists.
3. One interactive transaction that returns a result and never throws, so a failed attempt still commits: lock the user row; load the latest OTP (`usedAt` null, newest `createdAt`). Missing, expired or `attempts >= 5` yields `invalid`. A wrong code commits `attempts + 1` and yields `invalid`. A match claims the OTP with `updateMany({ id, usedAt: null })` (count 0 yields `invalid`), updates `passwordHash`, and revokes all of the user's unrevoked refresh tokens.
4. `invalid` becomes `AppError("INVALID_OTP", 400, "Invalid or expired code")`, one message for every failure.

### D5. Delivery seam
`OtpSender { send(email, otp): void }` is injected into `createAuthService`. The default console sender logs `[password-reset] OTP for <email>: <code>`. `AppDeps` gets an optional `otpSender`; tests capture codes through it. This is the only place the raw OTP exists after generation.

### D6. Schemas and errors
All in `packages/shared/src/auth.ts`: `INVALID_OTP` added to `errorCodeSchema`; `forgotPasswordRequestSchema`, `forgotPasswordResponseSchema` (fixed message), `resetPasswordRequestSchema` (`otp` matches `^\d{6}$`, `newPassword` 8 to 128) and inferred types. Routes reuse `parseBody`.

## Files

- Modify: `packages/shared/src/auth.ts`; `apps/backend/src/auth/auth.service.ts`; `apps/backend/src/auth/auth.routes.ts`; `apps/backend/src/app.ts`; `apps/backend/src/auth/test-helpers.ts`; backend README note.
- Create: `apps/backend/src/auth/otp.ts` (`generateOtp`, `hashOtp`, `verifyOtp`, `consoleOtpSender`, TTL and attempt constants).
- Tests (titles are scenario names verbatim, `describe("auth: ...")`): `forgot-password.test.ts` (7), `reset-password.test.ts` (13), `otp.test.ts` (`[design]` helpers), shared-schema and error-leak tests (2). Expiry and lockout are set up by writing `expiresAt` / `attempts` through Prisma.
- "Reset leaves no partial state on failure": `vi.spyOn` on `prisma.$transaction` so the callback receives a `tx` whose `refreshToken.updateMany` throws; assert the OTP is unused, the password unchanged and no token revoked.
- "OTP is a 6-digit code logged to the console": use the default console sender with a `console.log` spy.

## Risks / Trade-offs

- Known-email requests do DB writes that unknown-email requests skip, so a timing side channel on `forgot-password` remains (accepted; rate limiting is out of scope).
- A 6-digit code with 5 attempts per OTP gives roughly 5 in 10^6 per issued code; repeated `forgot-password` requests can retry. Mitigation (cooldown or rate limit) is deferred.
- Reusing `JWT_SECRET` as the HMAC key means rotating it invalidates outstanding OTPs; acceptable given the 10-minute lifetime.

## Verification

`pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage`, `openspec validate ab-1003`, plus a manual smoke run (register, forgot, read OTP from console, reset, old password and old refresh token both 401).
