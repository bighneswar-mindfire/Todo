---
description: Implement an approved task list. Usage - /implement AB-1002
---

Ticket: $ARGUMENTS

1. Refuse to continue unless spec, plan and tasks are all explicitly approved (Rules 2 and 3).
2. Work through `tasks.md` in order. Tick each task as it completes.
3. Ask `[y/n]` before every file write (Rule 10). Verify every library API against live docs through Context7 before using it (Rule 9). Pin exact versions (Rule 20).
4. Types and Zod schemas go only in `packages/shared` (Rule 11). Soft delete sets `deletedAt` only (Rule 15).
5. Use `/parallel` for tasks marked `[PARALLEL]` (Rule 7). Delegate tasks over 45 minutes to a subagent (Rule 6). Run `/compact` at about 70% context (Rule 5).
6. After every phase checkpoint run `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`. Never continue past a failing checkpoint (Rule 12).
7. Commit as `feat(scope): description AB#<number>` only when everything is green (Rules 13, 14).
