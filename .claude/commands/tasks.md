---
description: Break the approved plan into tasks (Rule 3). Usage - /tasks AB-1002
---

Ticket: $ARGUMENTS

1. Refuse to continue unless the plan (`design.md`) has been explicitly approved.
2. Write `openspec/changes/<ticket>/tasks.md` as a checklist grouped by phase. Each group ends with a checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`.
3. Map every spec scenario to exactly one named test task.
4. Mark tasks that can run independently with `[PARALLEL]` (for example frontend vs backend). Mark any task estimated over 45 minutes for a subagent (Rule 6). Name the model per task: Haiku for boilerplate, Sonnet for implementation, Opus for architecture only (Rule 8).
5. Ask `[y/n]` before every file write (Rule 10).
6. STOP. Wait for explicit approval of the tasks before `/implement` (Rule 3).
