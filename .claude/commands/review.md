---
description: Review the current branch against its OpenSpec change in a fresh context. Usage - /review ab-1013
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git status), Bash(git rev-parse:*), Read, Write, Edit, Glob, Grep, Agent
---

Change: $ARGUMENTS

This must run in a FRESH session. If this session already holds implementation work for the change, tell the user to run `/clear` (or open a new Claude Code terminal) and run `/review` again, then stop.

Read `.claude/rules/handoff.md` and `.claude/rules/checkpoint.md` first.

1. If no change name was given, infer it from the branch name (for example `feature/frontend/AB-1013-search-ui` -> `ab-1013`) and say which one you are using.
2. **Handoff check**: read `openspec/changes/<change>/handoff.md`. The latest `apply` block must be `COMPLETE`; otherwise stop with "Run `/opsx:apply <change>` first" (name the latest block found). Run `git status`: uncommitted changes outside the change folder mean stop and ask the user to commit or stash. Note `git rev-parse --short HEAD`. Read `review.md`: every group has a checkpoint section whose last round is `PASS`, and there is an `apply | final` section. A group with no section, or whose last round is `FAIL`, stops the review with "Run `/opsx:apply <change>` first" and names the group.
3. Delegate to the `reviewer` sub-agent: review `git diff main...HEAD` against `openspec/changes/<change>/` and `docs/FRS.md`. Pass it the apply block's `open:` low findings so it can confirm them still hold.
4. Delegate to the `security-auditor` sub-agent on the same diff. Run `db-change-checker` as well only if the diff touches `apps/backend/prisma/`.
5. Print each agent's table unchanged, then one line: `REVIEW: PASS` only if every agent reports PASS and no high-severity finding is open, otherwise `REVIEW: FAIL` with the count of open findings.
6. **Record**: first append a `## <date> | review | fresh-session review | PASS|FAIL` section to `openspec/changes/<change>/review.md` in the format of `.claude/rules/checkpoint.md` (create the file with its header if missing; never edit an earlier section): `head`, one table row per agent run with its RESULT, and each agent's findings table unchanged. Then append `### review | <date> | PASS|FAIL` to `handoff.md` with `head:` the SHA from step 2, `produced:` agents run and their RESULT lines, `open:` each open finding as one line (severity, file, summary), `next:` `/create-pr <change>` on PASS, otherwise "fix in a normal session, then `/review <change>` again". `review.md` and `handoff.md` of the change are the only files this command may edit.
7. Do not fix anything from this command. If it fails, tell the user to fix the findings in a normal session and run `/review` again. If it passes, the next step is `/create-pr <change>`; any commit made after this review makes it stale.
