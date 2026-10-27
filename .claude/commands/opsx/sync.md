---
name: "OPSX: Sync"
description: "Sync delta specs from a change to main specs"
allowed-tools: Bash(pnpm exec openspec:*), Read, Write, Edit, Glob, Grep
category: "Workflow"
tags: ["workflow", "specs", "experimental"]
---

Sync a change's delta specs into the main specs by an agent-driven merge (not a copy). The change stays active.

**OpenSpec root**: `pnpm exec openspec list --json`; `"root": null` means stop and tell the user (never run `openspec init` or hand-create `openspec/`).

**Input**: optional change name (`/opsx:sync ab-1042`). Else infer from the conversation, auto-select a single active change with delta specs, or list with `pnpm exec openspec list --json` and ask. Announce "Using change: <name>".

**Steps**

0. **Handoff**: read `.claude/rules/handoff.md` and `<changeRoot>/handoff.md`. Unless called by archive (which already checked), the latest `pr` block must be `OPENED` and the user must confirm the PR is merged (or `gh pr view` says `MERGED`); then append `### pr | <date> | MERGED`. No `pr` block: stop, "Run `/create-pr <name>` first".
1. `pnpm exec openspec status --change "<name>" --json`. Main specs live in `<planningHome.root>/openspec/specs/`.
2. **Delta paths**: use only `artifactPaths.specs.existingOutputPaths`. Missing or empty -> report no delta specs and stop. Sync all of them unless a caller (archive, or the user) names an explicit subset of those exact absolute entries: then sync only those and never widen. A named path not in the list -> report it and stop; an empty named list -> nothing to sync.
3. **Rules snapshot**: before the first main-spec write, run `pnpm exec openspec instructions specs --change "<name>" --json` once (reuse the snapshot archive supplies). Non-zero exit or invalid JSON -> report and stop before any write. Omitted `rules` means none. Use rules only as constraints on the merged content; never copy their text.
4. **Per delta spec**: read the delta, then the main spec at `<planningHome.root>/openspec/specs/<capability-path>/spec.md` (may not exist).
   - **No main spec** (new capability): only ADDED applies. MODIFIED or RENAMED present -> stop that capability, report it, never invent the missing requirement. REMOVED -> skip with a warning. Otherwise create the file: title `# <capability> Specification`, `## Purpose` copied verbatim from the delta (TBD placeholder only if none), `## Requirements` with the ADDED requirements. A REMOVED-only delta with `retire_capabilities: true` in the change's `.openspec.yaml` is already retired: continue without recreating; without the marker report it blocked (`Spec must have at least one requirement`). An empty delta is blocked too. Never write an empty `## Requirements`.
   - **ADDED**: add if absent; if present, update to match.
   - **MODIFIED**: find the requirement and apply the changes (new or changed scenarios, description); keep everything the delta does not mention, in the existing order. A MODIFIED block carries the whole requirement; one that drops a scenario the main spec still has fails validation.
   - **REMOVED**: remove the whole requirement block. If that leaves no requirements, delete the spec (and its directory when empty) only when ALL hold: it was not already empty before this run; it still has `## Purpose` and every other nonblank line is accounted for (title, Purpose, Requirements header, canonical requirements); the change's `.openspec.yaml` has `retire_capabilities: true`; the path resolves inside the real specs root (no symlink escape). Otherwise change nothing, report the blocking condition (name a missing marker as the one fix), and never leave an empty `## Requirements`. On retirement name the deleted file and its Purpose, with a `git checkout` recovery line.
   - **RENAMED** (`FROM:`/`TO:`): rename the requirement.
   - **Delta `## Purpose`** on an existing main spec: ignore; the main Purpose is authoritative.
   - Main specs never contain delta headers (`## ADDED/MODIFIED/REMOVED/RENAMED Requirements`); every requirement sits under one `## Requirements` heading as `### Requirement:` with `#### Scenario:` blocks.
5. **Validate**: `pnpm exec openspec validate --specs`. On failure report the problems; do not claim success.
6. **Summarise** per capability: requirements added/modified/removed/renamed, new specs created, any TBD Purpose to write now, any retirement.

**Output**

```
## Specs Synced: <change-name>
**<capability>**: Added "X"; Modified "Y" (added 1 scenario); Created new spec file
Main specs are updated. The change remains active; archive after the PR is merged.
```

Append `### sync | <date> | DONE` to `handoff.md` (`produced:` capabilities synced, `checks:` `validate --specs` result, `next: /opsx:archive <name>`). Skip when archive called sync inline; archive writes its own block.

After a merged PR, the next step is `/opsx:archive <change-name>`.

**Guardrails**
- Read the delta and the main spec before changing anything; preserve unmentioned content; show changes as you go; ask when unclear.
- Idempotent: running twice gives the same result.
- Never copy a delta file into a main spec as is.
- Never infer delta specs from other artifacts.
