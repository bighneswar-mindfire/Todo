## 1. Shared schemas (`packages/shared`)

- [x] 1.1 Export `listMeta` from `packages/shared/src/notes.ts` (Haiku)
- [x] 1.2 Add `packages/shared/src/search.ts`: `searchQuerySchema`, `searchResultSchema`, `searchResponseSchema` and types `SearchQuery`, `SearchResult`, `SearchResponse`; export from `index.ts` (Sonnet)
- [x] 1.3 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. Backend refactor

- [x] 2.1 Move `tagsInclude`, `flattenTags` and `excerpt` from `notes.service.ts` to `apps/backend/src/notes/summary.ts`; import them in `notes.service.ts` (Haiku)
- [x] 2.2 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test` (existing notes tests unchanged and green)

## 3. Search endpoint

- [x] 3.1 `apps/backend/src/search/search.service.ts`: tag ownership check (404), shared `Prisma.Sql` predicate, match query with `websearch_to_tsquery` and `ts_rank(...)::float8`, count query, `$transaction`, ORM hydration reordered by rank (Sonnet)
- [x] 3.2 `apps/backend/src/search/search.routes.ts`: `createSearchRouter` with `authenticate` and `parseQuery(searchQuerySchema, req.query)`; mount `/search` in `app.ts` before `errorHandler` (Sonnet)
- [x] 3.3 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 4. Tests (one named test per spec scenario, titles exactly as in `spec.md`)

All test files share `buildTestApp` / `cleanupUsers` and the notes helpers (`DOC`, `registerAndLogin`, `createNote`, `createTag`, `attachTag`, `auth`). Tasks 4.1 to 4.7 touch separate files and can run in parallel after section 3.

- [x] 4.1 [PARALLEL] `search.auth.test.ts` sets (Haiku)
  - Missing token rejected
- [x] 4.2 [PARALLEL] `search.query.test.ts` (Sonnet)
  - Match on title
  - Match on body
  - Stemmed match
  - All words must match
  - Phrase search
  - Exclusion
  - No match returns an empty page
  - Stop-word-only query returns an empty page
  - Unbalanced syntax does not error
  - Item shape
- [x] 4.3 [PARALLEL] `search.scope.test.ts` (Sonnet)
  - Other users' notes are never returned
  - Deleted notes are excluded
  - Restored note is searchable again
  - Edits are reflected
- [x] 4.4 [PARALLEL] `search.rank.test.ts` (Sonnet)
  - Title match outranks body match
  - Ties fall back to recency (set `updatedAt` via Prisma)
- [x] 4.5 [PARALLEL] `search.pagination.test.ts` (Haiku)
  - Search paginates
  - Invalid pagination rejected
- [x] 4.6 [PARALLEL] `search.validation.test.ts` (Haiku)
  - Missing or blank query rejected
  - Overlong query rejected
- [x] 4.7 [PARALLEL] `search.tag.test.ts` (Haiku)
  - Filter by tag
  - Tag filter with other user's tag
  - Malformed tag filter rejected
- [x] 4.8 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage` (80% or above)

## 5. Verification

- [x] 5.1 Confirm 24 scenario tests, one per scenario, and that status codes match `delta-openapi.yaml` (Sonnet)
- [x] 5.2 Manual `curl` against the running backend: quoted phrase, `-word`, `q=the`, and the unbalanced `"unclosed quote &|!` (Sonnet)
- [x] 5.3 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage`

No task is estimated over 45 minutes, so none is marked for a subagent. No task needs Opus.
