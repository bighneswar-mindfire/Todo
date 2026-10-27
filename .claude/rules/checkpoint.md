# Checkpoint and review.md

Every task group ends with the same checkpoint, and every checkpoint leaves a record in `review.md`. A group with no record has not passed. This file is the evidence log; `handoff.md` (see `handoff.md`) is the state machine and only points here.

## The checkpoint

Runs at the end of **every** group, whatever its layer: shared, backend, frontend, e2e, docs, and database groups. Run every step even when an earlier one fails, so the record is complete; the checkpoint passes only if all applicable steps pass.

| # | Check | Command | Passes when |
|---|-------|---------|-------------|
| 1 | Build | `pnpm build` | 0 errors |
| 2 | Lint | `pnpm lint --max-warnings 0` | 0 errors, 0 warnings |
| 3 | Tests | `pnpm test` | 0 failed, 0 red. No new `.skip`, `.only` or `todo`; skipped count does not rise |
| 4 | Coverage | `pnpm test --coverage` | the run exits 0 (backend, frontend and shared each set 80% thresholds for statements, branches, functions and lines in their vitest config, so a miss fails the run), and every non-test file changed in the group has at least 80% line coverage in the per-file report. A changed file missing from the report is a failure unless it holds no executable code (types only), which the record states. `apps/e2e` and `packages/repo-checks` have no source coverage |
| 5 | Spec | `pnpm exec openspec validate <change> --strict` | valid |
| 6 | Scenarios | the tests named by the group's test tasks | every scenario test of this group is green, and its title equals the scenario name |
| 7 | Database | `db-change-checker` sub-agent | only when the group changed `apps/backend/prisma/` (`git diff --name-only <last checkpoint head> -- apps/backend/prisma`); no high or medium finding. Otherwise record `n/a (no prisma changes)` |
| 8 | Review | `reviewer` sub-agent (brief in `apply-delegation.md`) | `RESULT: PASS` |

Rules:

- **A red test fails the checkpoint.** Red tests exist only inside a group, between a test task and the implementation task that turns it green (test-first). None may be present at the checkpoint, and none may carry over a group boundary. Never fix a red test by editing, skipping or weakening it.
- **A group of only docs or config** still runs steps 1 to 3, 5 and 8; step 4 is `n/a (no source changes)`.
- **Never claim a step passed from memory.** Each result comes from the command run in this checkpoint; the record quotes the numbers (tests passed, lowest coverage file).
- **On FAIL:** fix high and medium findings and any red check, then run the whole checkpoint again as a new round. Ask the user after two failed rounds on the same finding.
- The final group also runs the full-diff reviewer (`git diff main...HEAD`, every scenario), as in `apply-delegation.md`.
- `security-auditor` is not part of the checkpoint; it runs in `/review`.

## review.md

`openspec/changes/<name>/review.md`, inside the change folder, committed by the human with the change, archived with it.

- **Append only.** Add a section at the end with Edit. Never rewrite, reorder or delete an earlier section, including failed rounds. A correction is a new section.
- Created by the first checkpoint with the header `# Review log: <name>` and the line `Append only. See .claude/rules/checkpoint.md.`
- No secrets, tokens, request bodies or ticket text. Paths, counts, commands and agent tables only.

### Section format

```
## <YYYY-MM-DD> | <apply|review> | <subject> | <PASS|FAIL>
head: <git rev-parse --short HEAD>
round: <n>        (checkpoint sections only; restarts at 1 for each group)

| Check | Command | Result |
|-------|---------|--------|
| build | pnpm build | 0 errors |
| lint | pnpm lint --max-warnings 0 | 0 warnings |
| test | pnpm test | 212 passed, 0 failed, 0 skipped |
| coverage | pnpm test --coverage | 4 changed files, lowest 86% (src/x.ts) |
| spec | openspec validate ab-1042 --strict | valid |
| scenarios | group test tasks | 6/6 green |
| database | db-change-checker | PASS / n/a (no prisma changes) |
| reviewer | reviewer | PASS (0 high, 0 medium, 2 low) |

Findings: <the agents' findings tables unchanged, or "none">
Next: <what happens now>
```

- `<subject>` for apply is `group <n>: <title>` or `final`. For `/review` it is `fresh-session review`.
- A `/review` section uses the same table with the rows that command ran (`reviewer`, `security-auditor`, `database` when relevant) and quotes each agent's table unchanged.
- The heading line is machine-readable: a later stage finds the latest section for a subject by reading headings.

## What the repository enforces

The `pre-commit` hook runs `.husky/check-review-log.mjs`. It rejects a commit that:

- changes or removes an existing line of a change's `review.md` or `handoff.md` (append-only, checked from the staged diff);
- ticks a group's checkpoint task in `tasks.md` while the latest `apply | group <n>` section of `review.md` is missing or `FAIL`.

The check reads the staged files, so `tasks.md` and `review.md` must be committed together. It cannot verify that the numbers in a section are true; that is what the `reviewer` and `/review` are for.

## Who writes what

| Writer | Section | When |
|--------|---------|------|
| `/opsx:apply` | `apply \| group <n>` | after every checkpoint round, PASS or FAIL |
| `/opsx:apply` | `apply \| final` | after the last group's full-diff reviewer |
| `/review` | `review \| fresh-session review` | after its agents return |

`handoff.md` blocks quote only the result and name the `review.md` heading, for example `checks: PASS, see review.md "2026-10-27 | apply | group 2"`.
