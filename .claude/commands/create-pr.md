---
description: Open the pull request for a verified change. Usage - /create-pr ab-1042
allowed-tools: Bash(git status), Bash(git diff:*), Bash(git log:*), Bash(pnpm:*), Bash(gh pr create:*)
---

Change: $ARGUMENTS

1. Refuse unless the latest review (`reviewer` sub-agent on `git diff main...HEAD`, run in a fresh context) has no open findings.
2. Run `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test --coverage` (at least 80% on new code) and `pnpm exec openspec validate <change> --strict`. Stop on any failure and show the output.
3. Summarise the diff. Write the PR description with: the ticket link (`AB#<number>`), the FRS requirements covered, a table mapping every spec scenario to its test name, and any risk or rollback notes.
4. Ask the user before pushing or creating the PR. Never push to `main` or force-push.
5. After the PR is merged, remind the user to run `/opsx:sync <change>` then `/opsx:archive <change>`.
