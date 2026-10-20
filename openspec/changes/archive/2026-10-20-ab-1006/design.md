## Context

AB-1006 adds `GET /search`: PostgreSQL full-text search over the caller's active notes, ranked and paginated, with an optional `tagId` filter. `Note.searchVector` (title weight A, `contentText` weight B, `english`) and its GIN index exist from AB-1001, so there is no Prisma schema or migration change.

**Goals**
- `GET /search?q=&tagId=&page=&limit=` per `specs/search/spec.md` and `delta-openapi.yaml`.
- Shared Zod schemas and types only in `packages/shared`. No new error code.

**Non-Goals**
- Highlighted snippets, prefix or typo-tolerant search, trash search, multi-tag filters, search UI (AB-1010+), non-English languages.

## Decisions

### D1. Shared schemas
`packages/shared/src/search.ts`, exported from `index.ts`:
- `searchQuerySchema = pageQuerySchema.extend({ q: z.string().trim().min(1).max(200), tagId: z.uuid().optional() })`
- `searchResultSchema = noteSummarySchema.extend({ rank: z.number() })`
- `searchResponseSchema = { items, page, limit, total }`, reusing `listMeta`, which is exported from `notes.ts`.
- Types via `z.infer`: `SearchQuery`, `SearchResult`, `SearchResponse`.

### D2. Layout
`apps/backend/src/search/search.routes.ts` and `search.service.ts`, mirroring notes and tags. `createSearchService({ prisma })` and `createSearchRouter(service, authenticate)`, mounted in `app.ts` with `app.use("/search", ...)` before `errorHandler`. The route uses `parseQuery(searchQuerySchema, req.query)` and `req.auth!.userId`.

### D3. Tag filter
Same as `notes.service.ts` `list`: `prisma.tag.findFirst({ where: { id: tagId, userId } })`, then `AppError("NOT_FOUND", 404, "Tag not found")`. A malformed id is rejected by `z.uuid()` as 400. The three-line check is duplicated, not refactored out of notes.

### D4. Match query
`$queryRaw` with `Prisma.sql`. A CTE `q AS (SELECT websearch_to_tsquery('english', ${q}) AS query)`, filtered by `n."userId" = ${userId}::uuid AND n."deletedAt" IS NULL AND n."searchVector" @@ q.query`, plus `EXISTS (SELECT 1 FROM "NoteTag" ...)` with `${tagId}::uuid` when a tag is given. Select `n.id` and `ts_rank(...)::float8 AS rank`, ordered by `rank DESC, n."updatedAt" DESC, n.id`, with `LIMIT`/`OFFSET`. `q` is always a bound parameter. `websearch_to_tsquery` never raises on malformed input, and a stop-word-only query matches nothing.

### D5. Count
A second `$queryRaw` (`count(*)::int`) with the same predicate, built once as a shared `Prisma.Sql` fragment, run with the data query in one `$transaction`. `count(*) OVER()` is not used because a page past the end returns no rows and would lose `total`.

### D6. Hydration
Load the page's notes with the ORM (`id in ids`, `tags: tagsInclude`), reorder to the ranked id order and attach `rank`. Skip the ORM query when there are no ids. `tagsInclude`, `flattenTags` and `excerpt` move from `notes.service.ts` to `apps/backend/src/notes/summary.ts` and are imported by both services.

### D7. Errors
Reuse `AppError` and the existing error handler with fixed messages. Never echo `q`.

## Files

- New: `packages/shared/src/search.ts`, `apps/backend/src/search/search.routes.ts`, `apps/backend/src/search/search.service.ts`, `apps/backend/src/search/search.*.test.ts`, `apps/backend/src/notes/summary.ts`
- Edit: `packages/shared/src/index.ts`, `packages/shared/src/notes.ts`, `apps/backend/src/notes/notes.service.ts`, `apps/backend/src/app.ts`

## Risks / Trade-offs

- `ts_rank` returns float4. Cast to `float8` so the driver returns a JS number.
- The "title outranks body" scenario depends on the A/B weights. Use one occurrence per note in the test.
- Raw SQL needs quoted camelCase columns and `::uuid` casts on parameters.
- Two queries per search (match and count) plus one ORM load. Acceptable at this scale and simpler than a window count.

## Verification

- `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test --coverage` green with Postgres up.
- One named test per spec scenario, with status codes matching `delta-openapi.yaml`.
- Manual `curl` against the running backend: quoted phrase, `-word`, `q=the`, and the unbalanced `"unclosed quote &|!`.
