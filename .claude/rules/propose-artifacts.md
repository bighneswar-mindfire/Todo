# Propose: artifact standards

Content rules for the artifacts `/opsx:propose` writes. The OpenSpec CLI supplies each artifact's `template`; this file says what must be filled in and how. Section names below are mandatory and appear in this order. Write "None" with a reason in a section that does not apply; never delete a section.

Ground every artifact in `AGENTS.md`, `docs/FRS.md`, `docs/SDS.md`, the current specs in `openspec/specs/` and the layer `CLAUDE.md` files. Invent no business rule: if the FRS does not say it, it is an open decision (see `open-decisions.md`).

## proposal.md

1. **Why**: ticket ID (`AB-xxxx`), the FRS requirement IDs it implements (`FR-...`), the FRS and SDS sections, and the user-visible problem. Distinguish observed behaviour (cite files) from proposed behaviour.
2. **What Changes**: bullets grouped by layer using the tags in `layout.md`. Observable behaviour, not implementation.
3. **Traceability**: table `FR ID | FRS wording (short) | Capability | Spec requirement`. Every FR ID mapped to the ticket in FRS section 4 appears once. An ID with no requirement is listed under Out of scope with the reason.
4. **Open decisions**: the table defined in `open-decisions.md`. Always present, even when every row is `Assumed`.
5. **Out of scope**: what the ticket will not do, citing FRS 1.1 or `AGENTS.md` for forbidden items (realtime collaboration, attachments, mobile app, OAuth, folders/nesting, real email).
6. **Capabilities**: New and Modified capability lists (exact directory names under `specs/`).
7. **Impact**: files and modules per layer, database changes (or "No schema change"), dependencies (or "None"), existing scenarios that must stay green.
8. **Rollback**: how to undo, and whether data or migrations are involved.
9. **Docs follow-up**: FRS or SDS rows to update at sync (for example the SDS section 10 status row).

## specs/<capability>/spec.md (delta)

- Operations: `ADDED`, `MODIFIED`, `REMOVED`, `RENAMED`. For `MODIFIED`, copy the whole current requirement from `openspec/specs/` first, keep its title exactly, then edit.
- Each requirement is one sentence with SHALL or MUST, ends with `Traces: FR-...` (one or more IDs), and has at least one scenario.
- Scenarios are `#### Scenario: <name>` with `**WHEN**` and `**THEN**` lines. The name is unique across the change, because it becomes the test title. Include status code and error code for every failure.
- Every capability that adds or changes an endpoint or a form has at least one **authorization-denied** scenario (401 unauthenticated, or 404 for another user's resource, never 403) and one **validation-failure** scenario (400 `VALIDATION_ERROR` or the field message in the UI). If a capability is genuinely public or read-only, add the scenario that proves it (for example "public view of a revoked link") and say why in the proposal.
- Cover the boundaries the FRS states (limits, lengths, retention windows, ordering) with one scenario each.
- No implementation detail (no function names, no library names).

## design.md

Sections in order: **Context**, **Goals / Non-Goals**, **Contract** (the `packages/shared` schemas and types to add or change, written first), **Data model** (cite SDS section 2; either the Prisma change with indexes and migration notes, or "No schema change"), **Decisions** (`D1`, `D2`, ... each with the choice, the reason and the rejected alternative), **Layer plan** (backend, frontend: modules, files, query keys, error mapping), **Security and privacy** (ownership scope, what must never be logged, rate or size limits), **Risks / Trade-offs**, **Migration and rollback**, **Open questions** (link to proposal decision IDs, none left `Open`).

Every Decision that settles an open decision names its ID (`resolves OD-2`).

## tasks.md

- **Conventions** block first: shell and PATH note for Node 22, scenario count per capability, the branch (`feature/{domain}/AB-{n}-{short-name}`), the commit format the human uses `type: description` (Claude does not commit), and the library APIs to verify with Context7 before use.
- Groups follow the dependency order in `layout.md`. A group has a number, a title, and tasks numbered `1.1`, `1.2`. Each task starts with its layer tag.
- Inside a group: test tasks first, then the implementation task(s) that make them pass, then a checkpoint.
- A test task names the test file and the spec requirement, lists the scenarios it covers by exact name, and is marked as a `test-writer` task. One scenario appears in exactly one test task and gets exactly one test.
- An implementation task says which test tasks it turns green.
- The checkpoint task ends **every** group (database groups too) and is the full checkpoint of `checkpoint.md`: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test` (0 red), `pnpm test --coverage` (at least 80% on the files the group changed), `pnpm exec openspec validate <change> --strict`, the group's scenario tests, `db-change-checker` when the group changes `apps/backend/prisma/`, then `reviewer`. Its result is appended to `review.md`.
- Size: about 1 to 2 hours of agent work and one commit per task.
- The last group is **Verification**: full-diff run of the checkpoint (coverage at least 80% on new code, `pnpm exec openspec validate <change> --strict`), reviewer sub-agent on `git diff main...HEAD`, then `/review <change>` in a fresh session.
- End the file with a **Scenario to test map**: table `Capability | Scenario | Test file | Task`. No scenario missing, none twice.

## delta-openapi.yaml

- Always present. OpenAPI 3.1, `info.version` is the ticket's release marker, `info.description` names the ticket and states in one paragraph whether endpoints are added, changed or untouched.
- Endpoint changes go under `paths`. Document method, `operationId`, security, request schema, and every response status with its error `code`. Use the error envelope `{ error: { code, message, details? } }`.
- When no endpoint changes, `paths: {}` and an `x-frontend-consumes` or `x-backend-exercises` map lists each endpoint the change relies on, with `onStatus` per status code (the observable reaction).
- Status codes must match the spec scenarios one to one. A scenario that expects a status the file does not list is a defect.

## Self-check before presenting

Run this checklist and fix gaps; report the result in the summary.

- Ticket row exists in FRS section 4 and every mapped FR ID is traced in the proposal table.
- No `Open` decision remains (the gate in `open-decisions.md` passed).
- Auth-denied and validation-failure scenarios exist where required.
- Scenario names are unique; the Scenario to test map covers every scenario once.
- `delta-openapi.yaml` statuses equal the scenario statuses.
- `pnpm exec openspec validate <change> --strict` passes.
- No new `any`, floating versions, packages or out-of-scope features are implied.
