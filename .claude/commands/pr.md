---
description: Archive the change and open the pull request (Rules 17-19). Usage - /pr AB-1002
---

Ticket: $ARGUMENTS

1. Refuse unless the latest `/review` shows all ✅ (no ❌ ⚠️ 🔴 📋).
2. Run the checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test --coverage` (>=80% on new code).
3. Run `openspec validate <ticket>` then `openspec archive <ticket>`. The change must move from `changes/` to `changes/archive/` (Rule 18).
4. Ask the user before pushing or creating the PR. The PR description lists every FRS requirement covered and every spec scenario tested with its test name (Rule 19), and ends with the attribution line.
5. Commits use `feat(scope): description AB#<number>`.
