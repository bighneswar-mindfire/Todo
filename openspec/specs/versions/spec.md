# versions Specification

## Purpose
TBD - created by archiving change ab-1009. Update Purpose after archive.

## Requirements

### Requirement: Version endpoints require authentication
The version endpoints (`GET /notes/{id}/versions`, `GET /notes/{id}/versions/{versionNumber}`, `POST /notes/{id}/versions/{versionNumber}/restore`) SHALL require a valid access token and SHALL only operate on notes owned by the authenticated user. Another user's note SHALL yield 404 `NOT_FOUND`, never 403.

#### Scenario: Missing token rejected
- **WHEN** a client calls any version endpoint without an `Authorization` header
- **THEN** the response is 401 with error code `UNAUTHORIZED`

#### Scenario: Other user's note hidden
- **WHEN** a user lists, reads or restores versions of a note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND` and nothing is changed

### Requirement: Versions are recorded and numbered
The system SHALL store each saved state of a note as an immutable version with `versionNumber` starting at 1 and increasing by exactly 1 per note, with no gaps. A version holds the `title`, `content` and derived `contentText` of the note as saved. Creating a note SHALL record version 1. The note update and the version insert SHALL happen in one transaction, and the note row SHALL be locked while the next number is allocated, so concurrent saves receive distinct consecutive numbers.

#### Scenario: Concurrent saves get consecutive numbers
- **WHEN** a note at version 1 receives five simultaneous `PATCH` requests that each change the title
- **THEN** all five succeed and the note's versions are numbered 1 to 6 with no duplicates or gaps

#### Scenario: Failed save leaves no version
- **WHEN** a `PATCH` is rejected with a validation error
- **THEN** the number of versions of the note is unchanged

#### Scenario: Versions are immutable snapshots
- **WHEN** a note is edited after version 1 was recorded and version 1 is read again
- **THEN** version 1 still has its original title and content

### Requirement: List versions
The system SHALL list the versions of an active note owned by the caller via `GET /notes/{id}/versions`, ordered by `versionNumber` descending, as `{ items, page, limit, total }`. Each item SHALL contain `id`, `versionNumber`, `title`, `excerpt` (first 200 characters of `contentText`) and `createdAt`, and SHALL NOT contain `content`. `page` SHALL default to 1 and `limit` to 20, with a maximum of 100.

#### Scenario: List returns versions newest first
- **WHEN** the owner creates a note and changes its title twice, then lists versions
- **THEN** the response is 200 with three items numbered 3, 2, 1 and `total` equal to 3

#### Scenario: List item is a summary
- **WHEN** the owner lists versions of a note with body text
- **THEN** each item has `excerpt` and no `content` field

#### Scenario: List paginates
- **WHEN** a note with 3 versions is listed with `page=2&limit=2`
- **THEN** the response contains 1 item (version 1), `page` 2, `limit` 2 and `total` 3

#### Scenario: Invalid pagination rejected
- **WHEN** the owner requests `limit=101` or `page=0`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: List is scoped to the note
- **WHEN** the owner has two notes with different histories and lists one note's versions
- **THEN** only that note's versions are returned

#### Scenario: Pre-existing note has empty history
- **WHEN** the owner lists versions of a note that was created before versioning and never edited since
- **THEN** the response is 200 with an empty `items` array and `total` 0

#### Scenario: List for a deleted note
- **WHEN** the owner lists versions of their soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: List with malformed note id
- **WHEN** the owner requests `/notes/not-a-uuid/versions`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Get version
The system SHALL return one version of an active note owned by the caller, including full `content`, via `GET /notes/{id}/versions/{versionNumber}`, with fields `id`, `noteId`, `versionNumber`, `title`, `content`, `createdAt`. `versionNumber` SHALL be an integer of at least 1.

#### Scenario: Get an earlier version
- **WHEN** the owner edits a note's content and then reads version 1
- **THEN** the response is 200 with the original title and content

#### Scenario: Unknown version number
- **WHEN** the owner reads version 99 of a note with 3 versions
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Version of another note not reachable
- **WHEN** the owner reads version 1 through the id of a different note of their own that has no version 1
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Malformed version number rejected
- **WHEN** the owner requests `/notes/{id}/versions/abc`, `/versions/0` or `/versions/1.5`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Get version of a deleted note
- **WHEN** the owner reads a version of their soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: History survives trash and restore
- **WHEN** the owner soft deletes a note and restores it from the trash
- **THEN** its versions are listed again unchanged and the trash restore added no version

### Requirement: Restore version
The system SHALL let the owner restore a version of an active note via `POST /notes/{id}/versions/{versionNumber}/restore` with no body. The note's `title` and `content` SHALL be set to those of the chosen version, `contentText` re-derived and `updatedAt` advanced, and the response SHALL be 200 with the updated note. A new version SHALL be recorded; existing versions SHALL NOT be modified or removed. When the chosen version already equals the current state, nothing SHALL be written. Tags and share links SHALL be unchanged.

#### Scenario: Restore copies the old state
- **WHEN** the owner changes a note from "Draft" to "Final" and restores version 1
- **THEN** the response is 200 with title "Draft" and the original content, and `GET /notes/{id}` returns the same

#### Scenario: Restore appends a new version
- **WHEN** the owner restores version 1 of a note that has 3 versions
- **THEN** the note then has 4 versions, version 4 equals version 1's title and content, and versions 1 to 3 are unchanged

#### Scenario: Restore re-derives search text
- **WHEN** the owner restores an earlier version whose content had different text
- **THEN** a search for the restored text finds the note and a search for the replaced text does not

#### Scenario: Restore of the current state is a no-op
- **WHEN** the owner restores the newest version
- **THEN** the response is 200 and the version count is unchanged

#### Scenario: Restore keeps tags
- **WHEN** the owner restores a version of a note that has a tag attached
- **THEN** the tag is still attached

#### Scenario: Restore unknown version
- **WHEN** the owner restores version 99 of a note with 3 versions
- **THEN** the response is 404 with error code `NOT_FOUND` and the note is unchanged

#### Scenario: Restore malformed version number
- **WHEN** the owner posts to `/notes/{id}/versions/0/restore`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Restore on a deleted note
- **WHEN** the owner restores a version of their soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND` and the note is unchanged
