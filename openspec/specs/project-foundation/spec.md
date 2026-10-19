# project-foundation Specification

## Purpose
TBD - created by archiving change ab-1001. Update Purpose after archive.

## Requirements

### Requirement: Pinned monorepo layout
The repository SHALL be a pnpm workspace containing `apps/backend`, `apps/frontend` and `packages/shared`, and every tool and dependency version SHALL be pinned exactly.

#### Scenario: Workspace packages resolve
- **WHEN** `pnpm install` is run at the repository root
- **THEN** all three workspace packages are linked and install without errors

#### Scenario: No floating versions
- **WHEN** any `package.json` is inspected
- **THEN** no dependency uses `latest`, `^` or `~`

#### Scenario: Wrong runtime rejected
- **WHEN** installation is attempted on a Node version other than 22 or a pnpm version other than 10
- **THEN** the install fails with an engine error

### Requirement: Database schema
The system SHALL provide a PostgreSQL 16 database defined by a Prisma schema covering User, RefreshToken, PasswordResetOtp, Note, Tag, NoteTag, ShareLink and NoteVersion.

#### Scenario: Migration applies to a clean database
- **WHEN** `docker compose up -d` is run and the Prisma migration is applied to an empty database
- **THEN** all eight tables exist and the migration exits with code 0

#### Scenario: Soft delete column present
- **WHEN** the Note table is inspected
- **THEN** it has a nullable `deletedAt` timestamp column

#### Scenario: Full-text search index present
- **WHEN** the Note table is inspected
- **THEN** it has a generated `tsvector` column with a GIN index

### Requirement: Shared types and schemas
All TypeScript types and Zod schemas SHALL live only in `packages/shared` and be consumed by the apps through the workspace dependency.

#### Scenario: Shared export is consumed
- **WHEN** the backend imports a schema from `@todo/shared`
- **THEN** `pnpm build` succeeds with 0 errors

### Requirement: Quality gates
The repository SHALL enforce build, lint and test success and conventional commit messages before any commit.

#### Scenario: Clean checkpoint
- **WHEN** `pnpm build`, `pnpm lint --max-warnings 0` and `pnpm test` are run
- **THEN** all three exit with code 0

#### Scenario: Failing check blocks commit
- **WHEN** a commit is attempted while lint, build or tests fail
- **THEN** the pre-commit hook rejects the commit

#### Scenario: Bad commit message rejected
- **WHEN** a commit message does not match `type(scope): description AB#ticket`
- **THEN** commitlint rejects the commit

### Requirement: Claude Code configuration
The repository SHALL include root and per-app `CLAUDE.md` files, a read-only `reviewer` agent, the workflow commands and the Context7 MCP configuration.

#### Scenario: Reviewer is read-only
- **WHEN** the `reviewer` agent definition is inspected
- **THEN** it grants no write or edit tools

#### Scenario: Context7 configured
- **WHEN** `.mcp.json` is inspected
- **THEN** it defines a pinned Context7 server

### Requirement: Health endpoint
The backend SHALL expose `GET /health` that reports service and database status.

#### Scenario: Healthy
- **WHEN** `GET /health` is called and the database is reachable
- **THEN** the response is 200 with `{ "status": "ok" }`

#### Scenario: Database down
- **WHEN** `GET /health` is called and the database is unreachable
- **THEN** the response is 503 with `{ "status": "error" }`
