# Spec Delta

## MODIFIED Requirements

### Requirement: Versions are recorded and numbered
The system SHALL store each saved state of a note as a version with `versionNumber` starting at 1 and increasing by exactly 1 per note, with no gaps. A version holds the `title`, `content` and derived `contentText` of the note as saved. Creating a note SHALL record version 1. The note update and the version write SHALL happen in one transaction, and the note row SHALL be locked while the next number is allocated, so concurrent saves receive distinct consecutive numbers. A save sent with `autosave` true SHALL update the note's newest version in place, instead of adding one, when that version was itself created by an autosave and is less than 5 minutes old; otherwise it SHALL add a version that later autosaves may update. A save without `autosave`, a create and a restore SHALL always add a version that no autosave ever changes. Every other version SHALL stay immutable.

#### Scenario: Concurrent saves get consecutive numbers
- **WHEN** a note at version 1 receives five simultaneous `PATCH` requests that each change the title
- **THEN** all five succeed and the note's versions are numbered 1 to 6 with no duplicates or gaps

#### Scenario: Failed save leaves no version
- **WHEN** a `PATCH` is rejected with a validation error
- **THEN** the number of versions of the note is unchanged

#### Scenario: Versions are immutable snapshots
- **WHEN** a note is edited after version 1 was recorded and version 1 is read again
- **THEN** version 1 still has its original title and content

#### Scenario: Autosaves in a burst share one version
- **WHEN** a note at version 1 receives two autosave patches a few seconds apart that change the content
- **THEN** the note has exactly two versions and version 2 holds the content of the second patch

#### Scenario: Autosave after the window adds a version
- **WHEN** the newest version was created by an autosave more than 5 minutes ago and another autosave patch changes the note
- **THEN** a new version is added and the older autosave version keeps its content

#### Scenario: Autosave never overwrites an explicit version
- **WHEN** the owner saves a title change without `autosave` and then sends an autosave patch that changes the content
- **THEN** the explicit version keeps its title and content and the autosave is recorded as a new version

#### Scenario: Explicit save after an autosave adds a version
- **WHEN** an autosave patch records version 2 and the owner then saves a different content without `autosave`
- **THEN** the note has version 3 with the new content and version 2 is unchanged

#### Scenario: Concurrent autosaves share one version
- **WHEN** a note at version 1 receives five simultaneous autosave patches that each change the content
- **THEN** all five succeed and the note has exactly two versions

#### Scenario: Restore after an autosave adds a version
- **WHEN** an autosave patch records version 2 and the owner then restores version 1
- **THEN** the note has version 3 equal to version 1 and version 2 is unchanged

#### Scenario: Autosave on a deleted note is rejected
- **WHEN** the owner sends an autosave patch for a soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND` and no version is added or changed
