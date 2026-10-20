## Why

The brief defines AB-1008 as "Sharing: public read-only link with expiry, revoke and an atomic view count". Notes are private today. Owners need to hand a note to someone without an account, control how long the link lives, kill it on demand and see how often it was opened. The `ShareLink` table (`token` unique, `expiresAt`, `revokedAt`, `viewCount`) already exists from AB-1001, so no migration is needed. The sharing UI (a later frontend ticket) needs these endpoints.

## What Changes

- Owner endpoints (Bearer token):
  - `POST /notes/{id}/shares` creates a share link, optionally with `expiresAt`. Returns 201 with the link, including the secret `token`.
  - `GET /notes/{id}/shares` lists the note's links (active, expired and revoked), newest first, each with `viewCount`.
  - `DELETE /notes/{id}/shares/{shareId}` revokes a link by setting `revokedAt` (204). The row is kept so its view count survives.
- Public endpoint (no auth): `GET /shared/{token}` returns the note read-only (`title`, `content`, `updatedAt`) and counts the view.
- The view count is incremented **atomically**: one SQL statement, `UPDATE "ShareLink" SET "viewCount" = "viewCount" + 1 WHERE <token valid> RETURNING ...`, validates and counts in the same step. N concurrent opens always add exactly N, and a revoked, expired or deleted-note link is never counted.
- New request/response types and Zod schemas live only in `packages/shared`.

Decisions fixed for this ticket:
- **Token:** 32 bytes from `crypto.randomBytes`, base64url (43 characters, 256 bits). It is the only credential, so it is returned only to the authenticated owner and never logged. Stored as-is in the existing unique `token` column (the owner must be able to list it again).
- **Public failure is always 404 `NOT_FOUND`:** unknown, revoked, expired, and links whose note is soft deleted are indistinguishable (same body), so a holder learns nothing. A malformed token shape (not 43 base64url characters) is 400 `VALIDATION_ERROR`, like malformed ids elsewhere.
- **Soft-deleted note:** its links stop resolving immediately and resume if the note is restored within 30 days (links are not revoked by deletion). Creating or revoking a link on a deleted note is 404.
- **Expiry:** `expiresAt` is optional ISO datetime and MUST be in the future; omitted means the link never expires. A link is live while `now() < expiresAt`.
- **Multiple links per note** are allowed, each with its own token, expiry, revocation and count.
- **Revoke:** sets `revokedAt` only, never deletes the row. Revoking an already-revoked link is 404 `NOT_FOUND` with `revokedAt` unchanged, matching the soft-delete convention.
- **Public response** exposes only `title`, `content`, `updatedAt`. No ids, owner, tags, `viewCount` or expiry. Sent with `Cache-Control: no-store` (so every open reaches the server and is counted) and `Referrer-Policy: no-referrer` (so the token does not leak via the Referer header).
- **Counting rule:** every successful `GET /shared/{token}` counts, including the owner's own opens (the endpoint is anonymous, so the owner cannot be told apart).
- Ownership: all owner routes filter by `userId`; other users' notes and links are 404, never 403.
- No Prisma schema or migration change. No new error code.

## Capabilities

### New Capabilities
- `sharing`: owner-managed public read-only share links with expiry, revoke and an atomic view count.

### Modified Capabilities
- None.

## Impact

- Backend: new `src/sharing/` (`sharing.routes.ts`, `sharing.service.ts`, token helper); mounted in `app.ts` as `/notes/:id/shares` (via the notes router) and `/shared`.
- `packages/shared`: new `sharing.ts` schemas and types, exported from `index.ts`.
- Out of scope: password-protected links, per-link view analytics (who/when), editing through a link, rate limiting of the public endpoint, custom or vanity tokens, emailing links, extending an existing link's expiry (create a new one), the sharing UI.
