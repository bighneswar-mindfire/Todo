## Context

`GET /search` already matches, ranks, filters and paginates (`apps/backend/src/search/search.service.ts`). AB-1007 adds keyword highlighting. `delta-openapi.yaml` is approved: each item gains `highlight: { title, snippet }`, matched (stemmed) words wrapped in `<mark>`, all note text HTML-escaped, `<mark>`/`</mark>` the only markup. Additive, no migration, no new status or error code.

## Goals / Non-Goals

**Goals:** every scenario in `specs/search/spec.md` passes with exactly one named test; error codes unchanged.

**Non-Goals:** highlight in `GET /notes`, rich-text rendering, configurable markers, typo-tolerant search, search UI (AB-1013).

## Decisions

1. **Highlight in PostgreSQL with `ts_headline`**, using the same `websearch_to_tsquery('english', q)` as the match, so stemming agrees (`run` marks `running`) and excluded words are not marked. Alternative rejected: JS regex or stemmer, which diverges from PostgreSQL stemming.
2. **One extra query for the page only**, after ranking: `SELECT n.id, ts_headline(title ...) AS title_hl, ts_headline(contentText ...) AS snippet_hl FROM "Note" n CROSS JOIN websearch_to_tsquery(...) WHERE n.id = ANY(ids::uuid[]) AND n."userId" = userId::uuid`. Runs only when the page is non-empty, never over the whole match set (at most `limit`, max 100 rows), and stays scoped by `userId`. Results are merged by id into the existing item map.
3. **XSS safety with sentinels.** `StartSel`/`StopSel` are private-use characters U+E000/U+E001. SQL first strips both characters from the source text (`translate`), so note text can never contain a sentinel. The app then HTML-escapes (`& < > " '`) the whole `ts_headline` output and swaps sentinels for `<mark>`/`</mark>`. A literal `<mark>` in a note becomes `&lt;mark&gt;`. Alternative rejected: escaping in SQL, which is harder to read and test.
4. **Both title and body use `HighlightAll=true`** (source text returned untouched, only marks added). The snippet window is cut in the app: up to two windows of about 100 source characters around the first matches (one 200-character window if the text is short or has no second match), snapped to word boundaries and joined with `" ... "`. Changed during implementation from `MaxFragments` mode: fragment mode strips HTML-like tags (a literal `<mark>` in a note vanished instead of being escaped) and drops short leading words (`Tom &`), which contradicts the approved scenarios. Cost: the full `contentText` of the page rows (max 100) is returned from SQL and windowed in Node.
5. **No body match** (title-only match): the body output has no sentinel, so use `escapeHtml(excerpt(contentText))` (reuse `excerpt` from `notes/summary.ts`), with no marks.
6. **300-character bound.** The window size is in source characters, but escaping and tags add length, so the helper enforces it: drop the second fragment if over 300; for one oversize fragment, cut raw text at a word boundary before escaping and marking. Truncation never happens after tags or entities are built.
7. **Types** live only in `packages/shared`: `highlightSchema = z.object({ title, snippet })`, and `searchResultSchema` is extended with `highlight`.

## Files

- `packages/shared/src/search.ts` (and `index.ts` export): `highlightSchema`, `Highlight`.
- `apps/backend/src/search/highlight.ts` (new): `escapeHtml`, `buildHighlight`; pure and unit-testable.
- `apps/backend/src/search/search.service.ts`: headline query and merge.
- Tests: `search.highlight.test.ts` (Supertest, one test per scenario, named after it) and a small `highlight.test.ts` for the helper.
- `apps/backend/CLAUDE.md`: short AB-1007 note.

## Risks / Trade-offs

- `ts_headline` is CPU-heavy on very large text; bounded by running only on the page.
- Option-string quoting for the sentinels: passed as one bound parameter and verified by tests.
- Verified on PostgreSQL 16: negated terms are not marked ("Excluded words" test).
- Verify `ts_headline` options with Context7 before implementing.
