# Spec Delta

## ADDED Requirements

### Requirement: Search entry in the notes-list header
The notes-list header SHALL contain a `search` landmark with a text input labelled "Search notes" and a **Search** button. Submitting it with non-blank text SHALL navigate to `/search?q=<trimmed text>`. Submitting blank text SHALL do nothing. The header box SHALL NOT send any request itself.

#### Scenario: Submitting opens the search page
- **WHEN** a user types `budget` in the header search box on `/` and presses Enter
- **THEN** the app is on `/search?q=budget`

#### Scenario: Search button submits
- **WHEN** a user types `budget` and clicks **Search**
- **THEN** the app is on `/search?q=budget`

#### Scenario: Blank submit does nothing
- **WHEN** a user submits the header box with only spaces
- **THEN** the app stays on `/` and no `/search` request is sent

#### Scenario: Typing alone sends no request
- **WHEN** a user types in the header box without submitting
- **THEN** no `/search` request is sent
