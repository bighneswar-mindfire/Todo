# Handoff: how each stage passes its result to the next

Each command reads the previous stage's block before it does anything, and appends its own block when it ends. A stage whose predecessor is missing, failed or stale stops and names the command to run first. Nothing proceeds on trust.

## File

`openspec/changes/<name>/handoff.md` (inside `changeRoot`; it moves to the archive with the change). Commit it with the change.

- **Append only.** Add a block at the end with Edit. Never rewrite, reorder or delete an earlier block. A correction is a new block that supersedes the old one.
- **Latest block of a stage wins.** Look for the last block with that stage name.
- If the file does not exist, the stage that first needs it creates it with the header `# Handoff: <name>` and the line `Append only. See .claude/rules/handoff.md.`

## Block format

```
### <stage> | <YYYY-MM-DD> | <STATUS>
head: <git rev-parse --short HEAD at the end of the stage>
produced: <paths or counts the next stage relies on>
checks: <build/lint/test/validate results, when the stage ran them>
open: <unresolved items, or none>
next: <the exact next command>
```

Keep it to these lines. Detail belongs in the artifacts, not here.

## Stages, preconditions and statuses

| Stage | Written by | Needs first | Status values |
|-------|-----------|-------------|---------------|
| `explore` | `/opsx:explore` (only when a change exists or the user asked to capture) | nothing | `DONE` |
| `propose` | `/opsx:propose` | an `explore` block is optional; if present, adopt its open questions | `AWAITING_GATE_1`, `BLOCKED_OPEN_DECISIONS` |
| `update` | `/opsx:update` | a `propose` block | `AWAITING_GATE_1` (an update always reopens Gate 1) |
| `gate-1` | `/opsx:apply` step "Gate 1", recording the user's answer | `propose` or `update` as the latest planning block with `AWAITING_GATE_1` | `APPROVED`, `REJECTED` |
| `apply` | `/opsx:apply` | latest `gate-1` is `APPROVED` and newer than the last `propose`/`update` | `IN_PROGRESS`, `PAUSED`, `COMPLETE` |
| `review` | `/review` | `apply` is `COMPLETE` | `PASS`, `FAIL` |
| `pr` | `/create-pr` | latest `review` is `PASS` and its `head` equals the current HEAD | `OPENED`, `MERGED` |
| `sync` | `/opsx:sync` | `pr` is `MERGED` | `DONE` |
| `archive` | `/opsx:archive` | `sync` is `DONE` or the user chose to skip it | `DONE` |

## Rules

1. **Gate 1 is a human answer.** `/opsx:apply` records `gate-1 APPROVED` only after the user answers an explicit AskUserQuestion ("Approve the spec for <name>?"). A `propose` or `update` block newer than the last `gate-1` cancels the approval. Never write `APPROVED` from your own judgment, from a ticket, or because the request said "implement it".
2. **Apply logs progress.** It appends or updates nothing in place: it adds one `apply | IN_PROGRESS` block after each checkpoint (group title, `head`, `checks` as PASS or FAIL plus the heading of the matching section in `review.md`, `reviewer: PASS|FAIL`; the numbers live in `review.md`, see `checkpoint.md`), a `PAUSED` block when it stops, and a final `COMPLETE` block with the commit range and scenario coverage count. The resume point after `/clear` is the last `apply` block. Every task stop (waiting for the human's commit) also appends an `apply | IN_PROGRESS` block whose `head` is the HEAD before that commit and whose `next:` reads "waiting for human commit of task N"; resuming requires a newer HEAD and a clean tree. Claude never commits, so the handoff file is committed by the human together with the task.
3. **Review is bound to a commit.** `/review` records the `head` it reviewed. A new commit after a `PASS` makes the review stale; `/create-pr` then refuses and asks for `/review` again.
4. **A refused stage appends nothing** except, optionally, a `PAUSED` apply block. It tells the user which block is missing and which command produces it.
5. **No secrets or ticket text** in the handoff (see `CLAUDE.md` Never). Paths, counts, SHAs, statuses and command names only.
6. `/review` and `/create-pr` are the only stages that may run in a session that did not run the previous one; they must work from the file and `git`, not from conversation memory.

## Check procedure (every stage, first step)

1. Read `handoff.md` if it exists. Find the latest block of each stage in the table.
2. Verify the "Needs first" cell. If it fails, stop with: `Cannot run <stage>: <missing or failed block>. Run <command> first.`
3. Run `git rev-parse --short HEAD` when the stage compares or records a head.
