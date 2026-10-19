## Why

A user who forgets their password has no way back into their account. AB-1002 delivered register/login/refresh/logout but explicitly left password recovery to this ticket. Real email is out of scope, so recovery uses a one-time passcode (OTP) that is logged to the server console in place of an email.

## What Changes

- `POST /auth/forgot-password`: takes an email. If an account exists, generates a 6-digit OTP valid for 10 minutes, stores only its hash in the existing `PasswordResetOtp` table and logs the OTP to the console. The response is identical (202) whether or not the account exists, so the endpoint cannot be used to enumerate accounts. The OTP is never in the response.
- `POST /auth/reset-password`: takes email, OTP and a new password. A correct, unexpired, unused OTP with attempts remaining sets the new password (hashed), marks the OTP used and revokes all of the user's refresh tokens, atomically. Every failure mode (unknown email, wrong, expired, used, locked) returns the same 400 `INVALID_OTP`.
- OTP rules: at most one active OTP per user (requesting a new one invalidates earlier unused ones); at most 5 wrong attempts per OTP, after which that OTP is dead even if the correct code is then submitted; single use.
- Shared Zod schemas and types for both endpoints, and a new `INVALID_OTP` error code, in `packages/shared` only.

Decisions fixed for this ticket:
- OTP: 6 digits from a CSPRNG, TTL 10 minutes, 5 attempts, stored hashed (never raw).
- "Delivery" is a `console` log line of the form `[password-reset] OTP for <email>: <code>`; no email is sent.
- No session is created by reset; the client logs in afterwards. Existing sessions are revoked so a stolen session does not survive a reset.
- The new password follows the AB-1002 rule (8 to 128 characters). Reusing the old password is allowed.
- `forgot-password` for an unknown email still returns 202 and logs nothing.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `auth`: adds forgot-password and OTP-based password reset requirements, and the `INVALID_OTP` error code.

## Impact

- Backend: two new routes in the auth router, new service methods, an OTP helper (generate, hash, compare) and a console OTP "sender" injected into the service so tests can capture it. No Prisma schema or migration change: `PasswordResetOtp` (`otpHash`, `attempts`, `expiresAt`, `usedAt`) from AB-1001 already covers it.
- `packages/shared`: new request/response schemas and types; `errorCodeSchema` gains `INVALID_OTP`.
- Out of scope: real email delivery, rate limiting or cooldown on `forgot-password`, IP-based lockout, auth UI (AB-1010), changing password while logged in, purging old OTP rows.
