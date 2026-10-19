---
description: Run [PARALLEL] tasks in separate git worktrees (Rule 7). Usage - /parallel AB-1002
---

Ticket: $ARGUMENTS

1. Read `tasks.md` and list the groups marked `[PARALLEL]`. Frontend and backend work must be in separate worktrees.
2. For each group create a worktree and branch, for example `git worktree add ../todo-<ticket>-backend -b feat/<ticket>-backend`.
3. Run one agent per worktree with only that group's tasks. Each agent follows `/implement` rules, including `[y/n]` before writes.
4. When all groups pass their checkpoint, merge the branches into the ticket branch, remove the worktrees, then run the full checkpoint (`pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`).
