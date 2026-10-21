---
description: Review the current branch against its OpenSpec change in a fresh context. Usage - /review ab-1013
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git status)
---

Change: $ARGUMENTS

This must run in a FRESH session. If this session already holds implementation work for the change, tell the user to run `/clear` (or open a new Claude Code terminal) and run `/review` again, then stop.

1. If no change name was given, infer it from the branch name (for example `feature/frontend/AB-1013-search-ui` -> `ab-1013`) and say which one you are using.
2. Delegate to the `reviewer` sub-agent: review `git diff main...HEAD` against `openspec/changes/<change>/` and `docs/FRS.md`.
3. Delegate to the `security-auditor` sub-agent on the same diff. Run `db-change-checker` as well only if the diff touches `apps/backend/prisma/`.
4. Print each agent's table unchanged, then one line: `REVIEW: PASS` only if every agent reports PASS and no high-severity finding is open, otherwise `REVIEW: FAIL` with the count of open findings.
5. Do not fix anything from this command. If it fails, tell the user to fix the findings in a normal session and run `/review` again. If it passes, the next step is `/create-pr <change>`.
