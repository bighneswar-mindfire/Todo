## Why

Users can create, organise and tag notes (AB-1004, AB-1005) but can only find a note by scrolling or by tag. Search closes that gap. The `Note.searchVector` generated tsvector column (title weight A, contentText weight B, `english` config) and its GIN index already exist from AB-1001, so this ticket is PostgreSQL full-text search over data we already maintain. The UI (AB-1010+) builds on it.

## What Changes

- `GET /search?q=`: full-text search over the caller's active notes, ranked by relevance, paginated.
- Optional `tagId` filter on search, same semantics as on `GET /notes`.
- Results are note summaries (`id`, `title`, `excerpt`, `tags`, `createdAt`, `updatedAt`) plus a numeric `rank`.
- Everything sits behind `authenticate` and is user-scoped. Another user's notes never appear.
- Shared Zod schemas and types in `packages/shared` only. No new error code.

Decisions fixed for this ticket:
- Query syntax: `websearch_to_tsquery('english', q)`, so users get plain words (AND), `"quoted phrases"`, `or` and `-exclusion`, and malformed input never raises a SQL error.
- Matching is on stemmed words (`running` matches `run`). There is no substring or prefix matching.
- `q` is trimmed, 1 to 200 characters. Missing, blank or overlong `q` returns 400 `VALIDATION_ERROR`.
- A query that parses to nothing (for example only stop words such as `the`) is valid and returns an empty page with `total` 0.
- Ordering: `ts_rank(searchVector, query)` descending, then `updatedAt` descending, then `id` for a stable order. Title matches outrank body matches through the existing A/B weights.
- Only active notes (`deletedAt` null) are searched. Trash search is not provided.
- `tagId` filter: a tag the caller does not own or that does not exist returns 404 `NOT_FOUND`; a malformed id returns 400.
- Pagination: `page` default 1, `limit` default 20, max 100, as elsewhere.
- No Prisma schema or migration change. Match and rank use `$queryRaw`; tags are loaded with the ORM for the matched ids.

## Capabilities

### New Capabilities
- `search`: full-text search over the caller's active notes with optional tag filter, ranking and pagination.

### Modified Capabilities
- None. `GET /notes` is unchanged.

## Impact

- Backend: new `/search` route and search service (raw SQL for match and rank), wired in `app.ts`.
- `packages/shared`: search query and response schemas and types.
- Out of scope: highlighted snippets, prefix or typo-tolerant search, searching trash or note versions, multi-tag filters, saved searches, search-as-you-type UI (AB-1010+), languages other than English.
