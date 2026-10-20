## MODIFIED Requirements

### Requirement: Create note
The system SHALL let an authenticated user create a note via `POST /notes` with a `title` and TipTap JSON `content`. The title SHALL be trimmed and 1 to 200 characters. The content SHALL be a JSON object with `type` equal to `"doc"`; when omitted it SHALL default to an empty document. The server SHALL derive `contentText` as the concatenated plain text of the content. The note and its version 1 (copy of the title, content and `contentText`) SHALL be created in one transaction.

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

#### Scenario: Create records version 1
- **WHEN** an authenticated user creates a note
- **THEN** the note has exactly one version, numbered 1, with the same title and content

### Requirement: Update note
The system SHALL let the owner partially update an active note via `PATCH /notes/{id}` with `title` and/or `content`. At least one field SHALL be supplied. Validation rules match creation. When `content` changes, `contentText` SHALL be re-derived. `updatedAt` SHALL advance. When the resulting title or content differs from the note's current title or content, a new version SHALL be recorded in the same transaction (see the `versions` capability); when neither differs, the response SHALL be 200 and no version SHALL be recorded.

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

#### Scenario: Update records a new version
- **WHEN** the owner patches the title of a note that has version 1
- **THEN** the note has two versions and version 2 carries the new title and current content

#### Scenario: Unchanged patch records no version
- **WHEN** the owner patches `title` and `content` with values equal to the current ones
- **THEN** the response is 200 and the note still has the same number of versions

#### Scenario: First edit of a pre-existing note starts its history
- **WHEN** the owner edits a note that has no versions because it predates versioning
- **THEN** the edit is recorded as version 1
