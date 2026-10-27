---
name: "OPSX: Apply"
description: "Implement tasks from an OpenSpec change (tests via test-writer, group checks via reviewer)"
allowed-tools: Bash(pnpm exec openspec:*), Bash(git status), Bash(git diff:*), Bash(git log:*), Bash(git rev-parse:*), Read, Write, Edit, Glob, Grep, Agent, AskUserQuestion
category: "Workflow"
tags: ["workflow", "artifacts", "experimental"]
---

Implement tasks from an OpenSpec change. Tests are written by the `test-writer` sub-agent, implementation by this session, each task group is checked by the `reviewer` sub-agent.

**Read before step 1:** `.claude/rules/handoff.md` (stage log), `.claude/rules/checkpoint.md` (group checkpoint and `review.md`), `.claude/rules/apply-delegation.md` (briefs, checks, preconditions) and `.claude/rules/layout.md`. Read the `CLAUDE.md` of each layer a task touches.

**Input**: optional change name (`/opsx:apply ab-1042`). Else infer from the conversation or branch, auto-select if one active change exists, else list with `pnpm exec openspec list --json` and ask. Announce "Using change: <name>".

**Steps**

1. **Check OpenSpec root**: `pnpm exec openspec list --json`; `"root": null` means stop and tell the user (never run `openspec init` or create `openspec/` yourself).
2. **Status**: `pnpm exec openspec status --change "<name>" --json` (schema, `changeRoot`, tasks artifact).
3. **Handoff and Gate 1** (`handoff.md`). Read `<changeRoot>/handoff.md`.
   - No `propose` block: stop, "Run `/opsx:propose <name>` first".
   - Latest `propose`/`update` block is `BLOCKED_OPEN_DECISIONS`: stop and list its `open:` rows.
   - Latest `gate-1` is `APPROVED` and newer than the last `propose`/`update`: continue. If the last `apply` block is `IN_PROGRESS` or `PAUSED`, this is a resume: the first pending task in `tasks.md` is the start, and its `head` must be an ancestor of HEAD (else stop and report).
   - Otherwise (no `gate-1`, or a newer `update`): show the Proposed summary (artifacts, scenario count, `Assumed` rows) and ask with AskUserQuestion "Approve the spec for <name>?" (Approve / Revise with /opsx:update). Approve: append `### gate-1 | <date> | APPROVED` (`produced: approved by user in session`). Revise: append `REJECTED` and stop.
   - Never infer approval from the request wording.
4. **Preconditions** (`apply-delegation.md`; stop and report if any fails): no `Open` row in the proposal's Open decisions table; `delta-openapi.yaml` exists; every scenario is in exactly one test task; `git status` shows no unrelated changes; on the feature branch, not `main`.
5. **Instructions**: `pnpm exec openspec instructions apply --change "<name>" --json`. `state: "blocked"` -> show the message, complete `missingArtifacts` via `openspec instructions <id>`, do not implement. `state: "all_done"` -> report and suggest `/review`. Treat `context` and `operationGuidance` as constraints; never copy them into files or count them as proof of completion.
6. **Read every file in `contextFiles`**, then show progress: schema, "N/M tasks complete", remaining tasks.
7. **Loop over pending tasks** (show "Working on task N/M: ..."):
   - **Test task** -> `Agent` with `subagent_type: "test-writer"` and the brief from `apply-delegation.md`. Then read the test file: titles equal scenario names, one test per scenario, real assertions, nothing outside test files touched; run it and confirm each test fails for the right reason. Defects go back via SendMessage. If the agent is unavailable, write the tests directly and say so.
   - **Implementation task** -> minimal code that turns the named failing tests green. Never edit, skip or weaken a test to get green.
   - **Checkpoint task** (end of every group, database groups included) -> run the full checkpoint in `.claude/rules/checkpoint.md`: build, lint, test, coverage on the files changed in the group, `openspec validate --strict`, the group's scenario tests, `db-change-checker` (`Agent`, `subagent_type: "db-change-checker"`) when the group changed `apps/backend/prisma/`, then the `reviewer` (`Agent`, brief in `apply-delegation.md`). Run every step even if one fails. **Any red test, failed check or `RESULT: FAIL` fails the checkpoint.** Append a section to `<changeRoot>/review.md` after every round, PASS or FAIL, in the format of `checkpoint.md`; never edit an earlier section. PASS: note `reviewer: PASS` on the checkpoint line in `tasks.md` and append `### apply | <date> | IN_PROGRESS` to `handoff.md` (`produced:` group title and tasks done N/M, `head`, `checks:` PASS plus the `review.md` heading, `open:` low findings, `next:` the next task). FAIL: fix high and medium findings and every red check (tests only through `test-writer`), then run the whole checkpoint again as the next round; ask after two failed rounds on one finding. Do not start the next group on a FAIL.
   - Before editing a checkbox confirm `sourcePath` and `line` still match the task; mark `- [x]` only when the specified behaviour is fully done; rerun the apply instructions to confirm progress.
   - **Never run `git commit` and never suggest a message; run `git add` only if the user asks for it.** One task, one commit, made by the human. When a task is done (checkbox `[x]`, its checks run), stop and report: `## Task N/M done - waiting for your commit`, the files changed (`git status`), the checks run and their results. Then wait.
   - **Never edit a spec, `delta-openapi.yaml` or the scenarios to fit the code.** If a scenario looks wrong, pause (step 8) and suggest `/opsx:update`; the spec fix is its own commit, before any code that depends on it. The pre-commit hook rejects a commit that mixes the two, so if the task's files include both, stop and tell the user to split them.
   - **Resume** only when the user says they committed. Verify: `git status` shows a clean tree (apart from untracked files that existed before), and `git log -1` shows a commit newer than the head recorded at the last stop. If not, say what is missing and wait again. Do not start the next task before this check passes.
8. **Pause** (report, give options, wait) on: unclear task; design issue (suggest `/opsx:update`); work beyond the spec or temptation to drop, narrow or defer specified behaviour; a new unresolved behaviour question (add it as `Open` to the register, ask, resume after the answer); any error or blocker. On every pause append `### apply | <date> | PAUSED` with the reason in `open:` and `next:`.
9. **Complete**: when all tasks are `[x]`, run the reviewer on the full diff (`git diff main...HEAD`, every scenario), append an `apply | final` section to `review.md`, then append `### apply | <date> | COMPLETE` to `handoff.md` (`head`, `produced:` commit range `main..HEAD` and "M/M tasks, S/S scenarios have a passing test", `checks:` final build/lint/test, `open:` low findings, `next: /review <name>` in a fresh session).

**Output**

During: `## Implementing: <change> (schema: <schema>)`, then per task `Working on task N/M: ...` and `✓ Task complete`.

On completion:

```
## Implementation Complete
**Change:** <name>  **Progress:** M/M tasks complete

### Scenario coverage
| Capability | Scenario | Test file | Test | Result |   (one row per scenario, from the last pnpm test)

### Delegation
- test-writer: <n> calls, <n> sent back
- reviewer: <group> PASS/FAIL (<n> findings, <n> open); final full-diff run PASS/FAIL
- Low findings left open: <list or none>

### Checkpoints (from review.md)
| Group | Rounds | Result | build | lint | test | coverage (lowest) | spec | database | reviewer |

Next, in a FRESH session: `/review <name>`, then `/create-pr <name>`. Archive only after merge.
```

On pause: `## Implementation Paused`, change, progress N/M, the issue, numbered options, "What would you like to do?".

**Guardrails**
- Never write code before `gate-1 APPROVED` is in `handoff.md`; never edit or delete earlier handoff blocks.
- Keep going until done or blocked; keep changes minimal and scoped to each task; update the checkbox immediately.
- Do not guess on errors or ambiguity; never silently narrow, defer or simplify specified behaviour.
- Test tasks go to `test-writer`, group checks to `reviewer`; do not hand-write scenario tests while the agent is available.
- Never mark a group done without its `review.md` section; never rewrite or delete an earlier section.
- Apply does not replace `/review`: never run `security-auditor` here; `db-change-checker` runs only in the checkpoint of a group that changed `apps/backend/prisma/`. The reviewer pass does not clear Gate 2.
- Preserve CLI-controlled blocked/ready/all-done behaviour. Can be invoked at any time and may suggest artifact updates.
