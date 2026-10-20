## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command.
- Model per task: Haiku = boilerplate, Sonnet = implementation. No Opus task (no architecture work left; design.md is approved).
- No task is estimated over 45 minutes, so no subagent is needed. `[PARALLEL]` marks tasks that touch separate files and can run in separate worktrees.
- Test files hold one test per scenario, titled exactly as the scenario.

## 1. Shared types

- [x] 1.1 Add `highlightSchema` (`title`, `snippet` strings) and `Highlight` type to `packages/shared/src/search.ts`; extend `searchResultSchema` with `highlight`; export from `index.ts` (Haiku)
- [x] 1.2 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. Highlight helper

- [x] 2.1 Verify `ts_headline` options (`StartSel`, `StopSel`, `HighlightAll`, `MaxFragments`, `MinWords`, `MaxWords`, `FragmentDelimiter`) with Context7 before coding (Sonnet)
- [x] 2.2 [PARALLEL] Create `apps/backend/src/search/highlight.ts`: `escapeHtml`, sentinel swap, `buildHighlight` with no-body-match fallback via `excerpt()` and the 300-character bound (Sonnet)
- [x] 2.3 [PARALLEL] Unit tests `apps/backend/src/search/highlight.test.ts` for the helper: escape of `& < > " '`, sentinel swap, fragment dropping, oversize cut (Sonnet)
- [x] 2.4 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 3. Service

- [x] 3.1 In `search.service.ts`, add the page-only headline query (strip sentinels with `translate`, `ts_headline` for title with `HighlightAll=true` and for `contentText` with fragments, scoped by `userId`, only when the page is non-empty); merge by id and add `highlight` to each item (Sonnet)
- [x] 3.2 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 4. Scenario tests (`apps/backend/src/search/search.highlight.test.ts`)

Requirement: Search results include highlighted title and snippet
- [x] 4.1 Test "Title match is highlighted" (Sonnet)
- [x] 4.2 Test "Body match is highlighted in the snippet"
- [x] 4.3 Test "Stemmed variants are highlighted"
- [x] 4.4 Test "Every query word is highlighted"
- [x] 4.5 Test "Excluded words are not highlighted" (confirms the negated-term risk on PostgreSQL 16)
- [x] 4.6 Test "Title-only match still returns a snippet"
- [x] 4.7 Test "Long body snippet is bounded"
- [x] 4.8 Test "Existing fields unchanged"

Requirement: Highlight output is HTML-safe
- [x] 4.9 Test "HTML in a note is escaped"
- [x] 4.10 Test "Literal mark tags in a note are escaped"
- [x] 4.11 Test "Ampersands and quotes are escaped"

Requirement: Highlight respects scope, filters and pagination
- [x] 4.12 Test "Highlight with pagination"
- [x] 4.13 Test "Highlight with tag filter"
- [x] 4.14 Test "Empty page has no highlights"
- [x] 4.15 Test "Highlight never leaks other users' text"

- [x] 4.16 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 5. Docs and wrap-up

- [x] 5.1 Add the "Search highlight (AB-1007)" note to `apps/backend/CLAUDE.md` (Haiku)
- [x] 5.2 Run `pnpm test --coverage`; confirm the Definition of Done thresholds hold
- [x] 5.3 Manual check: register, create a note, `GET /search?q=run`, confirm `highlight` in the JSON
- [x] 5.4 Final checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`
- [x] 5.5 Commit `feat(search): add highlighted title and snippet to search results AB#1007` (asks before pushing; `/review AB-1007` in a fresh terminal comes next)
