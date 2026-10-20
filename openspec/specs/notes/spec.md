# notes Specification

## Purpose
TBD - created by archiving change ab-1004. Update Purpose after archive.

## Requirements

### Requirement: Notes require authentication
All `/notes` endpoints SHALL require a valid access token via the `authenticate` middleware and SHALL only ever read or modify notes owned by the authenticated user.

#### Scenario: Missing token rejected
- **WHEN** a client calls any `/notes` endpoint without an `Authorization` header
- **THEN** the response is 401 with error code `UNAUTHORIZED`

### Requirement: Create note
The system SHALL let an authenticated user create a note via `POST /notes` with a `title` and TipTap JSON `content`. The title SHALL be trimmed and 1 to 200 characters. The content SHALL be a JSON object with `type` equal to `"doc"`; when omitted it SHALL default to an empty document. The server SHALL derive `contentText` as the concatenated plain text of the content.

#### Scenario: Create note with valid input
- **WHEN** an authenticated user posts a valid title and TipTap document to `/notes`
- **THEN** the response is 201 with the note `id`, `title`, `content`, `createdAt`, `updatedAt`, `deletedAt` null, and the note is stored with that user as owner

#### Scenario: Title is trimmed
- **WHEN** a user creates a note with title `"  Groceries  "`
- **THEN** the returned and stored title is `Groceries`

#### Scenario: Content omitted defaults to empty document
- **WHEN** a user creates a note with a title and no content
- **THEN** the response is 201 and the content is an empty TipTap document

#### Scenario: Plain text derived from content
- **WHEN** a user creates a note whose content contains text nodes "Hello" and "world" in separate paragraphs
- **THEN** the stored `contentText` contains both words in document order

#### Scenario: Empty title rejected
- **WHEN** a user creates a note with a title that is empty or only whitespace
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Overlong title rejected
- **WHEN** a user creates a note with a title longer than 200 characters
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Invalid content rejected
- **WHEN** a user creates a note whose content is not an object with `type` equal to `"doc"`
- **THEN** the response is 400 with error code `VALIDATION_ERROR` and no note is created

#### Scenario: Oversized body rejected
- **WHEN** a user posts a request body larger than 1 MB to `/notes`
- **THEN** the response is 400 with error code `VALIDATION_ERROR` and no note is created

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

### Requirement: Get note
The system SHALL return one active note owned by the caller, including full `content`, via `GET /notes/{id}`. A note that does not exist, belongs to another user, or is soft deleted SHALL yield 404 `NOT_FOUND`.

#### Scenario: Get own note
- **WHEN** a user requests the id of their own active note
- **THEN** the response is 200 with the full note including `content`

#### Scenario: Other user's note hidden
- **WHEN** a user requests the id of a note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Unknown note
- **WHEN** a user requests a well-formed id that does not exist
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Deleted note not retrievable
- **WHEN** a user requests the id of their own soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Malformed id rejected
- **WHEN** a user requests `/notes/not-a-uuid`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Update note
The system SHALL let the owner partially update an active note via `PATCH /notes/{id}` with `title` and/or `content`. At least one field SHALL be supplied. Validation rules match creation. When `content` changes, `contentText` SHALL be re-derived. `updatedAt` SHALL advance.

#### Scenario: Update title only
- **WHEN** the owner patches only `title`
- **THEN** the response is 200 with the new title, unchanged content and a later `updatedAt`

#### Scenario: Update content re-derives text
- **WHEN** the owner patches `content` with new text
- **THEN** the response is 200 and the stored `contentText` reflects the new content only

#### Scenario: Empty patch rejected
- **WHEN** the owner patches with an empty object
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Invalid field rejected
- **WHEN** the owner patches with an empty title
- **THEN** the response is 400 with error code `VALIDATION_ERROR` and the note is unchanged

#### Scenario: Cannot update another user's note
- **WHEN** a user patches a note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND` and the note is unchanged

#### Scenario: Cannot update a deleted note
- **WHEN** the owner patches a soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND`

### Requirement: Soft delete note
The system SHALL soft delete a note via `DELETE /notes/{id}` by setting `deletedAt` to the current time. It SHALL NOT physically remove the row or its content.

#### Scenario: Delete sets deletedAt only
- **WHEN** the owner deletes an active note
- **THEN** the response is 204, the row still exists with `deletedAt` set and its title and content unchanged

#### Scenario: Deleted note leaves the list
- **WHEN** the owner deletes a note and then calls `GET /notes`
- **THEN** the note is not in the list

#### Scenario: Delete already-deleted note
- **WHEN** the owner deletes a note that is already soft deleted
- **THEN** the response is 404 with error code `NOT_FOUND` and `deletedAt` is unchanged

#### Scenario: Cannot delete another user's note
- **WHEN** a user deletes a note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND` and the note's `deletedAt` stays null

### Requirement: Trash listing
The system SHALL list the caller's soft-deleted notes still inside the 30-day restore window (measured from `deletedAt`) via `GET /notes/trash`, ordered by `deletedAt` descending, with the same summary shape and pagination as `GET /notes` plus `deletedAt`.

#### Scenario: Trash shows own deleted notes
- **WHEN** a user with one deleted note and one active note calls `GET /notes/trash`
- **THEN** the response is 200 with only the deleted note and `total` 1

#### Scenario: Trash excludes notes past 30 days
- **WHEN** a note was deleted 31 days ago
- **THEN** it is absent from `GET /notes/trash` and its row still exists in the database

#### Scenario: Trash isolated per user
- **WHEN** another user has deleted notes
- **THEN** they do not appear in the caller's trash

### Requirement: Restore note
The system SHALL restore a soft-deleted note via `POST /notes/{id}/restore` by clearing `deletedAt`, provided it was deleted within the last 30 days.

#### Scenario: Restore within window
- **WHEN** the owner restores a note deleted 5 days ago
- **THEN** the response is 200 with the note and `deletedAt` null, and it appears in `GET /notes` again

#### Scenario: Restore outside window rejected
- **WHEN** the owner restores a note deleted 31 days ago
- **THEN** the response is 404 with error code `NOT_FOUND` and `deletedAt` is unchanged

#### Scenario: Restore an active note rejected
- **WHEN** the owner restores a note that is not deleted
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Cannot restore another user's note
- **WHEN** a user restores a deleted note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND` and the note stays deleted
