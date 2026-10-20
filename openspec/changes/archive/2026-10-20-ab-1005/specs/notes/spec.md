## MODIFIED Requirements

### Requirement: List notes
The system SHALL return the authenticated user's active notes via `GET /notes`, ordered by `updatedAt` descending, as summaries (`id`, `title`, `excerpt`, `tags`, `createdAt`, `updatedAt`) with pagination. `excerpt` SHALL be the first 200 characters of `contentText`. `tags` SHALL be an array of `{ id, name, color }` ordered by name. `page` SHALL default to 1 and `limit` to 20, with a maximum of 100. An optional `tagId` query parameter SHALL restrict the result (and `total`) to active notes carrying that tag; the tag MUST belong to the caller.

#### Scenario: List returns only own active notes
- **WHEN** a user with two active notes, one deleted note, and a second user with one note calls `GET /notes`
- **THEN** the response is 200 with exactly the two active notes of the caller and `total` equal to 2

#### Scenario: List ordered by most recently updated
- **WHEN** a user lists notes after updating the older of two notes
- **THEN** the updated note appears first

#### Scenario: List paginates
- **WHEN** a user with 3 notes requests `page=2&limit=2`
- **THEN** the response contains 1 item, `page` 2, `limit` 2 and `total` 3

#### Scenario: Excerpt is truncated
- **WHEN** a note has 500 characters of text and the user lists notes
- **THEN** that item's `excerpt` is the first 200 characters and the item has no `content` field

#### Scenario: Invalid pagination rejected
- **WHEN** a user requests `limit=101` or `page=0`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Summaries include tags
- **WHEN** a user lists notes and one note has two attached tags
- **THEN** that item's `tags` contains both as `{ id, name, color }` ordered by name and untagged items have an empty `tags` array

#### Scenario: Filter by tag
- **WHEN** a user with three notes, two tagged `Work`, requests `GET /notes?tagId=<Work id>`
- **THEN** the response contains exactly the two tagged notes and `total` equal to 2

#### Scenario: Tag filter excludes deleted notes
- **WHEN** one of the two `Work` notes is soft deleted and the user filters by `Work`
- **THEN** the response contains only the remaining note and `total` equal to 1

#### Scenario: Tag filter with other user's tag
- **WHEN** a user filters by a tag owned by someone else or one that does not exist
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Malformed tag filter rejected
- **WHEN** a user requests `GET /notes?tagId=not-a-uuid`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`
