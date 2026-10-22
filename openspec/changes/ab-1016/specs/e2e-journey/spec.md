## ADDED Requirements

### Requirement: Isolated, self-starting E2E run
The command `pnpm test:e2e` SHALL start the backend and the frontend itself, run the browser suite against them and stop them afterwards. The backend SHALL use a dedicated PostgreSQL database (`todo_e2e`) whose migrations are applied before the first test, and the run MUST NOT read or write the development database. Each run SHALL register its own user with an email unique to that run, so reruns need no database cleanup. `pnpm test` SHALL NOT start the browser suite.

#### Scenario: E2E run uses its own database
- **WHEN** the suite starts
- **THEN** the backend it talks to is configured with the `todo_e2e` database and the migrations have been applied to it

#### Scenario: Reruns do not collide
- **WHEN** the suite is run twice in a row against the same `todo_e2e` database
- **THEN** both runs register successfully because each uses a different email

### Requirement: Full journey covered in one signed-in session
The suite SHALL cover FR-E2E-1 as one ordered journey for a single user, with exactly one named test per step, in this order: register, log in, create a note, edit with autosave, tag, search with highlight, share, open the public link anonymously, revoke, view history and restore, delete and restore from trash, log out. A step SHALL assert what the user sees, not internal state, and SHALL wait on visible UI conditions (status text, headings, list items), never on fixed sleeps.

#### Scenario: Register a new account
- **WHEN** a visitor submits the registration form with a valid unique email and password
- **THEN** the app shows the signed-in notes list at `/` with the user's email in the header

#### Scenario: Log in with the registered account
- **WHEN** the user logs out of the fresh session and submits the login form with the registered credentials
- **THEN** the app shows the notes list at `/` with the user's email in the header

#### Scenario: Create a note
- **WHEN** the user opens **New note**, types a title and body text and presses **Save**
- **THEN** the editor is on `/notes/<id>` and the notes list shows the note's title

#### Scenario: Edit with autosave
- **WHEN** the user changes the saved note's body and stops typing
- **THEN** the editor shows the saved status without any button being pressed and a page reload shows the new body

#### Scenario: Tag a note
- **WHEN** the user creates a tag with **New tag** in the editor
- **THEN** the tag is pressed on the note and the notes list shows the tag chip on that note

#### Scenario: Search with highlight
- **WHEN** the user searches for a word contained in the note
- **THEN** the results show the note with the matching word rendered inside a `<mark>` element

#### Scenario: Share a note
- **WHEN** the user opens **Share** and creates a link with no expiry
- **THEN** the dialog lists a link of the form `<origin>/shared/<token>` with status active

#### Scenario: Anonymous visitor opens the public link
- **WHEN** a browser context with no session opens the share URL
- **THEN** the shared page shows the note's title and body and no editing controls

#### Scenario: Revoke the share link
- **WHEN** the owner revokes the link and the anonymous context reloads the share URL
- **THEN** the dialog shows the link as revoked and the anonymous page shows the not-found state

#### Scenario: View history and restore a version
- **WHEN** the user opens **History**, previews an earlier version and restores it
- **THEN** the editor shows that version's body and the history lists a new latest version

#### Scenario: Delete and restore from trash
- **WHEN** the user deletes the note, opens **Trash** and presses **Restore** on it
- **THEN** the note is gone from the trash list and is back in the notes list with its tag

#### Scenario: Log out
- **WHEN** the user presses **Log out**
- **THEN** the app is on `/login` and opening `/` redirects back to `/login`

### Requirement: Guard scenarios outside the happy path
The suite SHALL also verify that a protected page refuses a visitor without a session and that an invalid form submission is rejected with a visible message, using a throwaway browser context separate from the journey user.

#### Scenario: Unauthenticated visit is redirected to login
- **WHEN** a visitor without a session opens `/`
- **THEN** the app is on `/login`

#### Scenario: Registration with an invalid password is rejected
- **WHEN** a visitor submits the registration form with a password the shared schema rejects
- **THEN** a validation message is shown and the visitor stays on `/register`

### Requirement: Failure diagnostics
The run SHALL keep a trace and a screenshot for every failing test under `apps/e2e/test-results/`, SHALL exit non-zero when any test fails, and SHALL NOT retry failed tests locally so that flakiness stays visible.

#### Scenario: Failure evidence is configured
- **WHEN** the Playwright configuration is loaded
- **THEN** traces and screenshots are retained on failure, retries are 0 and the output directory is `apps/e2e/test-results`
