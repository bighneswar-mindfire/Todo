## ADDED Requirements

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
