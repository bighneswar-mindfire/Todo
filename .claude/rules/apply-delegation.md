# Apply: delegation to sub-agents

`/opsx:apply` delegates tests to `test-writer` and verification to `reviewer`. The main session writes implementation code only. Delegation is real: the Agent tool is called with `subagent_type` set to the agent name, with the brief below. Never describe the work in prose and do it inline instead, unless the agent is unavailable (then say so in the progress output and do it inline).

## Test tasks -> `test-writer`

Call once per test task (a task that lists scenarios under one test file). Brief, filled in from the task:

```
Change: <change-name>
Layer: <shared | backend | frontend | e2e>  (read <layer CLAUDE.md> first)
Test file: <repo-relative path, from the task>
Spec: openspec/changes/<change>/specs/<capability>/spec.md, requirement "<title>"
Scenarios (write exactly one test each, title = scenario name verbatim):
  1. <scenario name>
  2. <scenario name>
Contract: openspec/changes/<change>/delta-openapi.yaml (status and error codes), packages/shared (types, schemas)
Helpers to reuse: <names from the layer CLAUDE.md, for example buildTestApp, renderApp, fake-api>
Run: <exact command, for example pnpm --filter @todo/backend test <file>>
Report: test file path, test titles, command output summary, and why each fails (feature missing, not a typo).
```

Main session, after the agent returns:

1. Read the test file. Check: titles equal the scenario names, one test per scenario, real assertions on status codes and bodies, no `any`, no snapshot-only or empty assertions, nothing outside test files touched (`git status`).
2. Run the command and confirm every new test fails for the right reason (missing route, missing component, missing function). A test that already passes is a defect: the scenario is either already implemented (note it) or the test is too weak (fix it).
3. If the brief was not followed, send it back to the same agent with SendMessage naming the defect. Do not hand-edit around it more than a trivial fix.
4. Only then mark the test task `[x]`, stop and wait for the human to commit it (`test: ...`; one task, one commit). Claude does not stage, commit or suggest the message. The Husky `commit-msg` hook skips `pnpm test` for `test(...)` commits, so the failing tests can be committed; build and lint must still pass, and the commit type must be `test`.

## Implementation tasks

Implement against the failing tests only, minimal and scoped. When the named tests are green, stop and wait for the human to commit before the next task. After the task, the tests it names turn green and nothing else turns red. No test is edited, skipped or weakened to get green; if a test looks wrong, pause and fix it through `test-writer` with a reason.

## Reviewer -> after each task group and at the end

After the checkpoint of every group, call the `reviewer` sub-agent (fresh context, read-only):

```
Change: <change-name>
Scope: git diff main...HEAD (limit attention to the group just finished: <group title, paths>)
Check against: openspec/changes/<change>/ (proposal, design, tasks, specs, delta-openapi.yaml), docs/FRS.md, AGENTS.md, layer CLAUDE.md
Report the findings table and RESULT.
```

Handling:

- `RESULT: PASS`: record `reviewer: PASS` on the group's checkpoint line in `tasks.md`, continue.
- `RESULT: FAIL`: fix high and medium findings in the main session (through `test-writer` for test defects), re-run the checkpoint, call `reviewer` again. Low findings are listed in the final summary. Stop and ask after two failed rounds on the same finding.
- Pending scenarios whose implementation sits in a later group are not defects; say which group in the brief.
- The reviewer runs on the final group in full scope (`git diff main...HEAD`, every scenario). The independent gate is still `/review <change>` in a fresh session before `/create-pr`; apply never replaces it and never runs `security-auditor` or `db-change-checker` (those belong to `/review`).

## Preconditions

Apply stops before the first task when: the Open decision register has an `Open` row, `tasks.md` lacks a test task for a scenario, or the working tree has unrelated changes. It reports which and waits.
