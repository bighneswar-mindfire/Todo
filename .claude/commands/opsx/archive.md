---
name: "OPSX: Archive"
description: "Archive a completed change in the experimental workflow"
allowed-tools: Bash(pnpm exec openspec:*), Bash(mkdir:*), Bash(mv:*), Read, Write, Edit, Glob, Grep
category: "Workflow"
tags: ["workflow", "archive", "experimental"]
---

Archive a completed change. Run only after the PR is merged and the change has been synced.

**OpenSpec root**: `pnpm exec openspec list --json`; `"root": null` means stop and tell the user (never run `openspec init`).

**Input**: optional change name. Else infer, auto-select a single active (not archived) change, or list and ask. Announce "Using change: <name>".

**Steps**

0. **Handoff**: read `.claude/rules/handoff.md` and `<changeRoot>/handoff.md`. The latest `pr` block must be `MERGED` (or `OPENED` and the user confirms it was merged; then append `MERGED`). Otherwise stop, "Run `/create-pr <name>` and merge first". A missing `sync` block is not a stop: step 4 handles sync.
1. **Archive inputs (advisory, never blocks)**: `pnpm exec openspec instructions archive --change "<name>" --json`. On non-zero exit or invalid JSON continue with none. `context` is a required prompt-level input; `operationGuidance` is optional advice. Neither overrides built-in steps, user choices, paths or CLI checks (report conflicts, keep the controlling value); never copy their text into specs, artifacts or summaries.
2. **Artifacts**: `pnpm exec openspec status --change "<name>" --json` (`planningHome`, `changeRoot`, `artifactPaths`, `artifacts`). Any artifact neither `done` nor `skipped` -> warn, list them, ask to continue.
3. **Tasks**: `pnpm exec openspec list --json`; require exactly one entry whose `name` matches and valid integers `totalTasks >= completedTasks >= 0`, else report and stop. Incomplete = `totalTasks - completedTasks` (only `x`/`X` counts). If > 0, warn and ask to continue. Zero total: no warning. Never infer completion from file names.
4. **Assess delta sync**: use only `artifactPaths.specs.existingOutputPaths`; none -> skip this step with no prompt. For each delta compare with `<planningHome.root>/openspec/specs/<capability-path>/spec.md`:
   - Missing main spec is not "already synced". MODIFIED or RENAMED present -> sync-blocked (only ADDED can create a spec). REMOVED-only with `retire_capabilities: true` -> already retired, counts as synced, no recreate. No ADDED otherwise -> sync-blocked (an unmarked REMOVED-only delta is refused by `openspec archive`). Else needs sync, noting `new main spec will be created` and that REMOVED items are ignored.
   - Work out the adds, modifications, removals and renames per capability; keep assessing after a blocked one; show one combined summary before prompting.
   - **Prompt**: any sync-blocked -> explain, offer only "Archive without syncing" / "Cancel". Changes needed -> "Sync now (recommended)" / "Archive without syncing". Already synced -> "Archive now" / "Sync anyway" / "Cancel". Cancel stops; archive options proceed to step 5; sync options run the sync and verify (below); never start a sync while a capability is blocked; anything else, ask again.
   - **Sync**: run `pnpm exec openspec instructions specs --change "<name>" --json` once (non-zero or invalid JSON -> report and stop before any write), then run the `/opsx:sync` workflow inline and synchronously, passing the delta analysis and that snapshot (sync must not fetch it again; never run it in the background, because step 5 would move `changeRoot` from under it). Any stop or blocking condition from the sync means the archive stops; nothing has moved.
   - **Verify** every capability with a delta (not only the ones sync reports touching), then re-run the comparison: ADDED present; MODIFIED carries the delta's changes with other scenarios intact; REMOVED gone (a retired capability's spec deleted, not left empty); RENAMED present under the new name only; new spec starts with `# <capability> Specification` and the delta's Purpose verbatim; existing Purposes untouched; no delta headers remain; `### Requirement:` / `#### Scenario:` headings under `## Requirements`. Any mismatch -> report and stop without archiving.
5. **Archive**: append `### archive | <date> | DONE` to `handoff.md` first (`produced:` target name, spec sync status), so the record moves with the change. Then `mkdir -p "<planningHome.changesDir>/archive"`. Target name is the change name when it already starts with `YYYY-MM-DD-`, else `YYYY-MM-DD-<name>` (never stack a second date). Target exists -> fail with options (rename the existing, delete if duplicate, or wait a day). Else `mv "<changeRoot>" "<planningHome.changesDir>/archive/<target-name>"`.
6. **Summary**: change, schema, archive location, spec sync status (synced / skipped / no delta specs), and any warnings (incomplete artifacts or tasks).

**Output**

```
## Archive Complete[ (with warnings)]
**Change:** <name>  **Schema:** <schema>
**Archived to:** <planningHome.changesDir>/archive/<target-name>/
**Specs:** Synced to main specs | No delta specs | Sync skipped (user chose to skip)
[Warnings: N incomplete artifacts, N incomplete tasks, sync skipped. Review the archive if unintended.]
```

On an existing target: `## Archive Failed` with change, target and the options above.

**Guardrails**
- Warnings inform and ask; they do not block. Show a clear summary.
- Never archive while a sync is in flight; sync inline and verify before moving `changeRoot`.
- With delta specs, always show the combined sync assessment before prompting.
- `.openspec.yaml` moves with the directory.
- Artifact rules constrain only the specs being written, not archive behaviour.
