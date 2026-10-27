---
name: "OPSX: Update"
description: "Update a change - revise existing planning artifacts and keep them coherent (Experimental)"
allowed-tools: Bash(pnpm exec openspec:*), Read, Edit, Glob, Grep
category: "Workflow"
tags: ["workflow", "artifacts", "experimental"]
---

Revise a change's existing planning artifacts and keep them coherent. Never edit code.

**Read first:** `.claude/rules/propose-artifacts.md` (standards each artifact must still meet after the edit) and `.claude/rules/open-decisions.md` (a revision that opens a new question adds an `Open` row and re-triggers the gate).

**OpenSpec root**: `pnpm exec openspec list --json`; `"root": null` means stop and tell the user (never run `openspec init`).

**Input** (`/opsx:update <what to change>`): an optional change name, then the revision. Else infer the change from the conversation or branch, auto-select a single active one, or list by recent modification (top 3-4 with name, task status and age, most recent marked "(Recommended)") and ask. Announce "Using change: <name>".

This workflow revises artifacts that exist; it never creates missing ones.

**Steps**

1. `pnpm exec openspec status --change "<name>" --json`: `schemaName`, `artifacts` (done, skipped, ready, blocked), `isPlanningComplete`, `changeRoot`, `artifactPaths`. Never hard-code artifact ids or paths. The files to edit are `artifactPaths.<id>.existingOutputPaths` (glob-expanded); never write to a glob `resolvedOutputPath`. `delta-openapi.yaml` is not a schema artifact: it sits in `changeRoot` and is reconciled too.
2. **Understand the request**: a named revision is the starting edit; "update" or "make coherent" means a coherence review of the artifacts against each other (contradictions, gaps, duplication, FR traceability, scenario-to-test map, status codes vs `delta-openapi.yaml`).
3. **Read and reconcile**: read the touched artifacts and all others. Draft the edit in the conversation only. Check every other existing artifact against it, in any direction (a later artifact can force an earlier one to change) and list what is now inconsistent, missing or contradictory. A revision usually ripples: spec scenario -> test task and map -> `delta-openapi.yaml` -> design decision -> proposal traceability. Already coherent -> say so, propose nothing. Artifacts with no files and status `ready` or `blocked`: note them and point to `pnpm exec openspec instructions "<id>" --change "<name>" --json`; leave `skipped` ones alone.
4. **Missing file under a partly populated glob artifact** (for example a new `specs/<capability>/spec.md`): get `instructions`, pick a concrete new path inside `changeRoot` matching `outputPath` (resolve symlinks, must stay inside), include it in the proposed revisions, create it only after confirmation, refresh status/instructions immediately before creating, and use a create that fails if the target exists. Any failed check -> stop and reconcile with the user.
5. **Confirm and apply, one artifact at a time**: show each proposed revision and why (including the requested edit); write only after the user confirms; a rejected revision leaves the artifact unchanged. For a substantial rewrite fetch the artifact's `instructions` first. Re-run `pnpm exec openspec validate "<name>" --strict` after the writes.
6. **Point to the next step (guidance only, never act)**: missing artifacts -> `instructions`; already applied -> the code may no longer match, suggest `/opsx:apply`; everything done and implemented -> `/opsx:archive`. After a revision of a proposed (not yet approved) change, Gate 1 is back: ask for approval again.

7. **Write the handoff**: append `### update | <date> | AWAITING_GATE_1` to `handoff.md` per `.claude/rules/handoff.md` (`produced:` the artifacts revised, `checks:` the validate result, `open:` anything deferred, `next: /opsx:apply <name> after approval`). This cancels any earlier `gate-1 APPROVED`. Skip only when nothing was revised.

**Output**: which artifacts were revised and which revisions were rejected; any file created under a glob artifact; anything deferred; where the change stands and the next command.

**Guardrails**
- Planning artifacts only; if the plan implies code changes, stop and point to `/opsx:apply`.
- Edit only `existingOutputPaths`, `delta-openapi.yaml`, and a confirmed new concrete path under a populated glob artifact.
- Do not advance the build frontier; confirm every edit before writing.
- If the request changes the change's intent rather than refining it, ask for a distinct unused name and recommend `pnpm exec openspec new change "<new-name>"` instead.
