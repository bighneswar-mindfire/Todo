## Why

The brief defines AB-1007 as "Search: full-text with highlight + pagination". `GET /search` already exists with full-text matching, ranking, pagination and a tag filter (shipped earlier under the label AB-1006). What is missing is keyword highlighting: results show a plain first-200-characters excerpt, so users cannot see why a note matched. The search UI (AB-1013) needs highlighted titles and snippets from the API.

## What Changes

- Each `GET /search` result gains a `highlight` object: `{ title, snippet }`, both strings in which matched words are wrapped in `<mark>...</mark>`.
- `highlight.title` is the full title. `highlight.snippet` is a short passage of the note text around the best matches (up to 2 fragments).
- Highlighting uses PostgreSQL `ts_headline` with the same `websearch_to_tsquery('english', q)` that does the matching, so stemmed variants are marked (`q=run` marks `running`).
- Existing fields (`excerpt`, `rank`, pagination, filters, errors) are unchanged. The change is additive and backward compatible.
- `highlight` types and Zod schemas are added to `packages/shared` only.

Decisions fixed for this ticket:
- Safety: `ts_headline` output is not XSS-safe (PostgreSQL docs warn about this, verified with Context7). The server SHALL HTML-escape all note text (`& < > " '`) and emit only `<mark>` and `</mark>` as markup. Clients may render `highlight.*` as HTML. Delimiters used inside the query are private sentinel strings swapped for `<mark>` after escaping, so user text containing a literal `<mark>` is escaped, not trusted.
- Only terms that contribute to a match are marked. Excluded words (`-tart`) are never marked.
- If the body has no matching word (the note matched on title only), `highlight.snippet` is the escaped leading text of the note with no marks.
- `highlight.snippet` is capped at about 200 characters of source text; `highlight.title` is not truncated.
- `ts_headline` runs only on the page's rows (at most `limit`, max 100), after ranking, never on the whole match set.
- Pagination already meets the brief (page default 1, limit default 20, max 100, `total`). No change.
- No Prisma schema or migration change. No new error code.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `search`: results carry highlighted title and snippet.

## Impact

- Backend: `search.service.ts` computes headlines for the paged ids; a small escape-and-mark helper.
- `packages/shared`: `searchResultSchema` extended with `highlight`.
- Out of scope: highlighting in `GET /notes`, highlighting inside rendered rich-text content, configurable markers, typo-tolerant or prefix search, search UI (AB-1013).
