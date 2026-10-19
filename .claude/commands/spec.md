---
description: Write the spec proposal for a ticket (Rule 1). Usage - /spec AB-1002
---

Ticket: $ARGUMENTS

1. Confirm this session is fresh for one ticket only (Rule 4). If other ticket work is in context, tell the user to run `/clear` first.
2. Create the change with `openspec new change <ticket in lowercase>` (OpenSpec requires lowercase names, for example `ab-1002`).
3. Write `proposal.md`, `specs/<capability>/spec.md` (every scenario testable, WHEN/THEN) and `delta-openapi.yaml` (every endpoint, request/response schema and HTTP status code).
4. Ask `[y/n]` before every file write (Rule 10). Verify library behavior with Context7 (Rule 9).
5. Run `openspec validate <ticket>`.
6. STOP. Summarise the spec and wait for explicit human approval of `delta-openapi.yaml` (Rule 2). Do not run `/plan` yourself.
