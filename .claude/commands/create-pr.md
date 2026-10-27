---
description: Open the pull request for a verified change. Usage - /create-pr ab-1042
allowed-tools: Bash(git status), Bash(git diff:*), Bash(git log:*), Bash(git rev-parse:*), Bash(pnpm:*), Bash(gh pr create:*), Bash(gh pr view:*), Read, Edit
---

Change: $ARGUMENTS

Read `.claude/rules/handoff.md` first.

1. **Handoff check**: read `openspec/changes/<change>/handoff.md`. The latest `review` block must be `PASS` and its `head:` must equal `git rev-parse --short HEAD`. No review block, a `FAIL`, or a different head (a commit after the review) means stop: "Run `/review <change>` in a fresh session first", naming which of the three failed. Also read `review.md`: its latest `review` section must be `PASS` with the same `head`; the PR description links the final result. Do not run the reviewer yourself to get around it.
2. Run `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test --coverage` (at least 80% on new code) and `pnpm exec openspec validate <change> --strict`. Stop on any failure and show the output.
3. Summarise the diff. Write the PR description with: the ticket link (`AB#<number>`), the FRS requirements covered, a table mapping every spec scenario to its test name, and any risk or rollback notes.
4. Ask the user before pushing or creating the PR. Never push to `main` or force-push.
5. **Record**: after the PR is created append `### pr | <date> | OPENED` to `handoff.md` (`head`, `produced:` PR URL, `checks:` the step 2 results, `next:` "after merge: `/opsx:sync <change>`"). Claude does not commit: tell the user the block was added and they commit and push it themselves.
6. After the PR is merged, remind the user to run `/opsx:sync <change>` then `/opsx:archive <change>`.
