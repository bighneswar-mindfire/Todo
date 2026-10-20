# search Specification

## Purpose
TBD - created by archiving change ab-1006. Update Purpose after archive.

## Requirements

### Requirement: Search requires authentication
`GET /search` SHALL require a valid access token and SHALL only return notes owned by the authenticated user.

#### Scenario: Missing token rejected
- **WHEN** a client calls `GET /search?q=meeting` without an `Authorization` header
- **THEN** the response is 401 with error code `UNAUTHORIZED`

### Requirement: Full-text search over notes
The system SHALL search the authenticated user's active (not soft-deleted) notes via `GET /search?q=<text>` using PostgreSQL full-text search over `searchVector` (title weighted above body, `english` configuration). `q` SHALL be interpreted with web-search syntax: plain words are ANDed, `"quoted text"` is a phrase, `or` is a union and a leading `-` excludes a word. Words SHALL be matched after stemming. The response SHALL be `{ items, page, limit, total }` where each item has `id`, `title`, `excerpt` (first 200 characters of `contentText`), `tags` (`{ id, name, color }` ordered by name), `createdAt`, `updatedAt` and `rank` (number).

#### Scenario: Match on title
- **WHEN** a user has notes titled `Quarterly budget` and `Holiday plans` and searches `q=budget`
- **THEN** the response is 200 with exactly the `Quarterly budget` note and `total` equal to 1

#### Scenario: Match on body
- **WHEN** a user has a note whose content text contains `invoice` and searches `q=invoice`
- **THEN** that note is returned

#### Scenario: Stemmed match
- **WHEN** a note contains the word `running` and the user searches `q=run`
- **THEN** that note is returned

#### Scenario: All words must match
- **WHEN** one note contains `apple pie` and another only `apple` and the user searches `q=apple pie`
- **THEN** only the first note is returned

#### Scenario: Phrase search
- **WHEN** one note contains `red apple` and another contains `apple red` and the user searches `q="red apple"`
- **THEN** only the note with the phrase in that order is returned

#### Scenario: Exclusion
- **WHEN** one note contains `apple pie` and another `apple tart` and the user searches `q=apple -tart`
- **THEN** only the `apple pie` note is returned

#### Scenario: No match returns an empty page
- **WHEN** no note matches the query
- **THEN** the response is 200 with an empty `items` array and `total` equal to 0

#### Scenario: Stop-word-only query returns an empty page
- **WHEN** a user searches `q=the`
- **THEN** the response is 200 with an empty `items` array and `total` equal to 0

#### Scenario: Unbalanced syntax does not error
- **WHEN** a user searches with the unbalanced query `"unclosed quote &|!`
- **THEN** the response is 200 and never 500

#### Scenario: Item shape
- **WHEN** a note with two tags and 500 characters of text matches
- **THEN** its item has `excerpt` of the first 200 characters, both tags ordered by name, a numeric `rank`, and no `content` field

### Requirement: Search is scoped to active notes of the caller
Search SHALL exclude soft-deleted notes and every other user's notes.

#### Scenario: Other users' notes are never returned
- **WHEN** another user has a note matching the query and the caller has none
- **THEN** the response is 200 with an empty `items` array and `total` equal to 0

#### Scenario: Deleted notes are excluded
- **WHEN** the only matching note is soft deleted
- **THEN** the response contains no items and `total` equal to 0

#### Scenario: Restored note is searchable again
- **WHEN** a soft-deleted note is restored and the user searches for a word in it
- **THEN** the note is returned

#### Scenario: Edits are reflected
- **WHEN** a user changes a note's content so it contains a new word and searches for that word
- **THEN** the note is returned, and a search for a removed word no longer returns it

### Requirement: Search ranking
Results SHALL be ordered by relevance (`ts_rank` over the weighted vector) descending, then `updatedAt` descending, then `id`.

#### Scenario: Title match outranks body match
- **WHEN** one note has `budget` in its title and another only in its body and the user searches `q=budget`
- **THEN** the title match is listed first and its `rank` is greater than the other's

#### Scenario: Ties fall back to recency
- **WHEN** two notes match with equal rank and one was updated more recently
- **THEN** the more recently updated note is listed first

### Requirement: Search pagination
`page` SHALL default to 1 and `limit` to 20, with a maximum of 100. `total` SHALL count all matches regardless of the page.

#### Scenario: Search paginates
- **WHEN** 3 notes match and the user requests `page=2&limit=2`
- **THEN** the response contains 1 item, `page` 2, `limit` 2 and `total` 3

#### Scenario: Invalid pagination rejected
- **WHEN** a user requests `limit=101` or `page=0`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Query validation
`q` SHALL be required, trimmed, and 1 to 200 characters.

#### Scenario: Missing or blank query rejected
- **WHEN** a user calls `GET /search` with no `q`, `q=` or a whitespace-only `q`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Overlong query rejected
- **WHEN** a user searches with a `q` of 201 characters
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Search filtered by tag
An optional `tagId` query parameter SHALL restrict results (and `total`) to matching notes carrying that tag. The tag MUST belong to the caller.

#### Scenario: Filter by tag
- **WHEN** two notes match `q=report`, only one tagged `Work`, and the user adds `tagId=<Work id>`
- **THEN** only the tagged note is returned and `total` is 1

#### Scenario: Tag filter with other user's tag
- **WHEN** a user filters by a tag owned by someone else or one that does not exist
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Malformed tag filter rejected
- **WHEN** a user requests `GET /search?q=report&tagId=not-a-uuid`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Search results include highlighted title and snippet
Each item returned by `GET /search` SHALL include `highlight: { title, snippet }`. Query words that matched, after stemming, SHALL be wrapped in `<mark>` and `</mark>`. `highlight.title` SHALL be the whole title and `highlight.snippet` up to two fragments of `contentText` around the best matches. Existing item fields SHALL be unchanged.

#### Scenario: Title match is highlighted
- **WHEN** a note titled `Quarterly budget review` matches `q=budget`
- **THEN** its `highlight.title` is `Quarterly <mark>budget</mark> review`

#### Scenario: Body match is highlighted in the snippet
- **WHEN** a note whose text contains `please send the invoice today` matches `q=invoice`
- **THEN** its `highlight.snippet` contains `<mark>invoice</mark>`

#### Scenario: Stemmed variants are highlighted
- **WHEN** a note contains the word `running` and the user searches `q=run`
- **THEN** `highlight.snippet` contains `<mark>running</mark>`

#### Scenario: Every query word is highlighted
- **WHEN** a note contains `apple pie` and the user searches `q=apple pie`
- **THEN** its highlighted text contains both `<mark>apple</mark>` and `<mark>pie</mark>`

#### Scenario: Excluded words are not highlighted
- **WHEN** a note contains `apple pie` and the user searches `q=apple -tart`
- **THEN** `<mark>` wraps `apple` and never `tart`

#### Scenario: Title-only match still returns a snippet
- **WHEN** a note matches only through its title and its body has no query word
- **THEN** `highlight.snippet` is the leading body text with no `<mark>` tags

#### Scenario: Long body snippet is bounded
- **WHEN** a note with several thousand characters of text matches a word near its end
- **THEN** `highlight.snippet` contains the `<mark>` for that word and is no longer than 300 characters including tags

#### Scenario: Existing fields unchanged
- **WHEN** a note matches
- **THEN** the item still has `excerpt` (first 200 characters of `contentText`), `rank`, `tags`, `createdAt` and `updatedAt` as before

### Requirement: Highlight output is HTML-safe
The server SHALL HTML-escape `&`, `<`, `>`, `"` and `'` in all note text placed in `highlight.title` and `highlight.snippet`, and SHALL emit no markup other than `<mark>` and `</mark>`.

#### Scenario: HTML in a note is escaped
- **WHEN** a note titled `<script>alert(1)</script> budget` matches `q=budget`
- **THEN** `highlight.title` is `&lt;script&gt;alert(1)&lt;/script&gt; <mark>budget</mark>`

#### Scenario: Literal mark tags in a note are escaped
- **WHEN** a note's text contains `<mark>budget</mark>` and the user searches `q=budget`
- **THEN** the snippet contains `&lt;mark&gt;<mark>budget</mark>&lt;/mark&gt;` and no unescaped user-supplied tag

#### Scenario: Ampersands and quotes are escaped
- **WHEN** a note's text contains `Tom & "Jerry" invoice` and matches `q=invoice`
- **THEN** the snippet contains `Tom &amp; &quot;Jerry&quot; <mark>invoice</mark>`

### Requirement: Highlight respects scope, filters and pagination
Highlights SHALL be produced for exactly the items of the requested page, and all existing scoping, tag filtering, ordering and pagination rules SHALL still hold.

#### Scenario: Highlight with pagination
- **WHEN** 3 notes match and the user requests `page=2&limit=2`
- **THEN** the response has 1 item with a `highlight`, `page` 2, `limit` 2 and `total` 3

#### Scenario: Highlight with tag filter
- **WHEN** two notes match `q=report`, only one is tagged `Work`, and the user adds `tagId=<Work id>`
- **THEN** the single returned item has `<mark>report</mark>` in its highlight and `total` is 1

#### Scenario: Empty page has no highlights
- **WHEN** no note matches
- **THEN** the response is 200 with empty `items` and `total` 0

#### Scenario: Highlight never leaks other users' text
- **WHEN** another user has a note matching the query and the caller has none
- **THEN** the response is 200 with empty `items`
