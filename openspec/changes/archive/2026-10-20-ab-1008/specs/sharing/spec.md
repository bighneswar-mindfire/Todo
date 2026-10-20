## ADDED Requirements

### Requirement: Share management requires authentication
The share management endpoints (`POST|GET /notes/{id}/shares`, `DELETE /notes/{id}/shares/{shareId}`) SHALL require a valid access token and SHALL only operate on notes owned by the authenticated user. Another user's note or link SHALL yield 404 `NOT_FOUND`, never 403.

#### Scenario: Missing token rejected
- **WHEN** a client calls any share management endpoint without an `Authorization` header
- **THEN** the response is 401 with error code `UNAUTHORIZED`

#### Scenario: Cannot manage another user's note
- **WHEN** a user creates or lists share links for a note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND` and no link is created

### Requirement: Create share link
The system SHALL let the owner create a share link for an active note via `POST /notes/{id}/shares`. The body is optional; it MAY contain `expiresAt`, an ISO datetime strictly in the future. When omitted the link never expires. The response SHALL be 201 with `id`, `noteId`, `token`, `expiresAt`, `revokedAt` null, `viewCount` 0 and `createdAt`. The token SHALL be 43 base64url characters generated from 32 cryptographically random bytes. A note MAY have several links, each with a distinct token.

#### Scenario: Create link without expiry
- **WHEN** the owner posts to `/notes/{id}/shares` with no body
- **THEN** the response is 201 with a 43-character base64url `token`, `expiresAt` null, `revokedAt` null and `viewCount` 0

#### Scenario: Create link with expiry
- **WHEN** the owner posts `expiresAt` one hour in the future
- **THEN** the response is 201 and `expiresAt` equals the supplied instant

#### Scenario: Past expiry rejected
- **WHEN** the owner posts an `expiresAt` that is not in the future
- **THEN** the response is 400 with error code `VALIDATION_ERROR` and no link is created

#### Scenario: Malformed expiry rejected
- **WHEN** the owner posts `expiresAt` equal to `"tomorrow"`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Multiple links get distinct tokens
- **WHEN** the owner creates two links for the same note
- **THEN** both succeed with different `id` and `token` values

#### Scenario: Cannot share a deleted note
- **WHEN** the owner creates a link for their own soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Malformed note id rejected
- **WHEN** the owner posts to `/notes/not-a-uuid/shares`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: List share links
The system SHALL list all share links of an active note owned by the caller via `GET /notes/{id}/shares`, ordered by `createdAt` descending, as `{ items }`. Each item has the create-response fields, including the current `viewCount`. Expired and revoked links SHALL be included, each with its `expiresAt` and `revokedAt`.

#### Scenario: List returns own note's links with counts
- **WHEN** the owner has a note with two links, one opened 3 times, and lists its shares
- **THEN** the response is 200 with both links newest first and the opened link's `viewCount` equal to 3

#### Scenario: List includes revoked links
- **WHEN** the owner revoked one of two links and lists the shares
- **THEN** both links are returned and the revoked one has `revokedAt` set

#### Scenario: List is scoped to the note
- **WHEN** the owner has links on two different notes and lists one note's shares
- **THEN** only that note's links are returned

#### Scenario: List for a deleted note
- **WHEN** the owner lists shares of their own soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND`

### Requirement: Revoke share link
The system SHALL let the owner revoke a link via `DELETE /notes/{id}/shares/{shareId}` by setting `revokedAt` to the current time, responding 204. It SHALL NOT remove the row, so the `viewCount` remains visible in the list. A link that does not exist, belongs to another note or user, or is already revoked SHALL yield 404 `NOT_FOUND` and leave `revokedAt` unchanged.

#### Scenario: Revoke sets revokedAt only
- **WHEN** the owner revokes an active link
- **THEN** the response is 204 and the row still exists with `revokedAt` set and `viewCount` unchanged

#### Scenario: Revoked link stops resolving
- **WHEN** the owner revokes a link and then requests `GET /shared/{token}`
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Revoke already revoked link
- **WHEN** the owner revokes a link that is already revoked
- **THEN** the response is 404 with error code `NOT_FOUND` and `revokedAt` is unchanged

#### Scenario: Cannot revoke another user's link
- **WHEN** a user revokes a link on a note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND` and the link stays active

#### Scenario: Link from a different note not revocable via this note
- **WHEN** the owner sends `DELETE /notes/{A}/shares/{shareId}` where the link belongs to note B
- **THEN** the response is 404 with error code `NOT_FOUND` and the link stays active

#### Scenario: Malformed share id rejected
- **WHEN** the owner sends `DELETE /notes/{id}/shares/not-a-uuid`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Public read-only note view
The system SHALL serve `GET /shared/{token}` without authentication. For a live link (not revoked, `expiresAt` null or in the future, note not soft deleted) the response SHALL be 200 with exactly `title`, `content` and `updatedAt` of the note, and the headers `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. The response SHALL NOT include the note id, owner, tags, `viewCount` or link details. The endpoint SHALL be read-only.

#### Scenario: Anonymous read of a shared note
- **WHEN** an unauthenticated client requests `GET /shared/{token}` for a live link
- **THEN** the response is 200 with the note's `title`, `content` and `updatedAt` and no other fields

#### Scenario: Response is not cacheable and hides referrer
- **WHEN** a client requests a live shared note
- **THEN** the response carries `Cache-Control: no-store` and `Referrer-Policy: no-referrer`

#### Scenario: Shared view reflects latest edit
- **WHEN** the owner edits the note title after creating the link and the link is then opened
- **THEN** the response contains the new title

#### Scenario: Unknown token
- **WHEN** a client requests a well-formed token that does not exist
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Expired link
- **WHEN** a client requests a link whose `expiresAt` has passed
- **THEN** the response is 404 with error code `NOT_FOUND` and the link's `viewCount` is unchanged

#### Scenario: Soft-deleted note not served
- **WHEN** the owner soft deletes the note and a client requests its live link
- **THEN** the response is 404 with error code `NOT_FOUND` and `viewCount` is unchanged

#### Scenario: Link resumes after restore
- **WHEN** the owner restores the soft-deleted note and a client requests the same link
- **THEN** the response is 200

#### Scenario: All failures look the same
- **WHEN** clients request an unknown, a revoked and an expired token
- **THEN** the three 404 response bodies are identical

#### Scenario: Malformed token rejected
- **WHEN** a client requests `GET /shared/short` or a token with characters outside the base64url set
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Atomic view count
Each successful `GET /shared/{token}` SHALL increase that link's `viewCount` by exactly one. Validation of the link and the increment SHALL happen in a single atomic database statement, so concurrent requests never lose or double count an increment and a link that is not live is never counted.

#### Scenario: Each view counts once
- **WHEN** a live link is opened 3 times in sequence
- **THEN** the owner's list shows `viewCount` 3

#### Scenario: Concurrent views are not lost
- **WHEN** 25 requests open the same live link at the same time
- **THEN** all 25 responses are 200 and `viewCount` is exactly 25

#### Scenario: Failed views are not counted
- **WHEN** a revoked link is requested twice
- **THEN** both responses are 404 and `viewCount` is unchanged

#### Scenario: Counts are per link
- **WHEN** a note has two links and only the first is opened
- **THEN** the first link's `viewCount` is 1 and the second's is 0

#### Scenario: Revoke racing with views never counts after revocation
- **WHEN** the owner revokes a link while it is being opened concurrently
- **THEN** after the revoke response every further open is 404 and the final `viewCount` equals the number of 200 responses
