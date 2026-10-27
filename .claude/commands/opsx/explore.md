---
name: "OPSX: Explore"
description: "Enter explore mode - read the ticket, code and specs, think through ideas, list open questions"
allowed-tools: Bash(pnpm exec openspec:*), Read, Write, Edit, Glob, Grep
category: "Workflow"
tags: ["workflow", "explore", "experimental", "thinking"]
---

Enter explore mode: a thinking partner, not a workflow. No fixed steps, no required output.

**Explore mode is for thinking, not implementing.** Read files, search code and run read-only commands freely, but NEVER write code or implement features, and never edit workflow config (schemas, templates, `openspec/config.yaml`). If asked to implement, say explore does not implement and point to `/opsx:propose`.

**Writes need confirmation.** You MAY create or update OpenSpec change artifacts, but only after you name the files and what changes, ask a direct yes/no question and the user confirms in a separate message. Confirmation covers only the described scope. Answers to design questions are never consent. A user's own explicit request to capture the exploration as a new change is that confirmation, for the change and the artifacts it names. Never create `openspec/changes/<name>/` by hand: use `pnpm exec openspec new change "<name>"`.

**OpenSpec root**: `pnpm exec openspec list --json`; `"root": null` means do not set anything up and answer normally (explicit OpenSpec request: tell the user, never run `openspec init` unasked).

**Input** (`/opsx:explore ...`): a ticket (`AB-1042`), a change name, a vague idea, a problem or a comparison; or nothing.

## Stance

Curious, not prescriptive; open threads, not interrogations; visual (plain ASCII diagrams only: `+ - |`, `-->`, `v`); adaptive; patient; grounded in the real code. Never fake understanding.

## Grounding (read before asking the user anything you can verify)

1. For a ticket: its row in `docs/FRS.md` section 4 and the mapped requirements in section 2, section 1.1 (out of scope), the relevant `docs/SDS.md` sections (data model, API contract, frontend design, status in section 10), and `AGENTS.md`.
2. `pnpm exec openspec list --json` (changes in flight) and `pnpm exec openspec list --specs`; read relevant specs in full with `pnpm exec openspec show "<spec-id>" --type spec`; read an existing change's artifacts via `pnpm exec openspec status --change "<name>" --json` (`artifactPaths.<id>.existingOutputPaths`).
3. `openspec/config.yaml` `context` and `rules` as constraints, never reproduced in output; the `CLAUDE.md` of each layer involved (`.claude/rules/layout.md`), then the source and tests.

## Planning a change

Guide toward shared understanding with focused questions; for open-ended talk, impose nothing.
- Follow dependencies: settle outcome and scope before API or data model; revisit downstream assumptions when an answer changes.
- One focused question at a time, with why it matters and what it unlocks. Batch only if asked.
- Recommend a path when evidence supports it, with alternatives and trade-offs. Never invent intent or constraints; ask when only the user knows.
- Keep the record in the conversation: separate confirmed decisions, proposed defaults and unresolved questions. Silence is not acceptance.
- End a ticket exploration with a list of **open questions** in the shape of the Open decisions table in `.claude/rules/open-decisions.md` (question, options, recommendation, impact), so `/opsx:propose` can adopt them. Stop asking when clarity is enough; let the user pause or defer.

## Capturing

- With no change: offer, when thinking has crystallised, to start one. Name the change and artifacts in the offer. If the user asks for a capture, scaffold with `pnpm exec openspec new change "<name>"`, then per requested artifact in dependency order use `pnpm exec openspec status ... --json` and `pnpm exec openspec instructions <id> --change "<name>" --json`: follow `template` and `instruction`, read `dependencies`, apply `context`/`rules` as constraints without copying, write inside `changeRoot`, verify the file. Evaluate conditional instructions and tell the user about a deliberate skip. Ask before creating any prerequisite the user did not request. Then stop and name where work continues: `/opsx:propose` for the rest, `/opsx:apply` once tasks exist.
- With a change: read its artifacts and refer to them naturally. Offer, never auto-capture: requirement -> `specs/<capability>/spec.md`, design decision -> `design.md`, scope change -> `proposal.md`, new work -> `tasks.md`. Other schemas: use the artifact from `artifactPaths` that fits; create none the schema lacks.

## Handoff

Explore's result must survive `/clear`. When a change exists, or the user asks to capture, and the user confirms the write (see "Writes need confirmation"), append one block to `openspec/changes/<name>/handoff.md` per `.claude/rules/handoff.md`: `### explore | <date> | DONE`, `produced:` (files read that matter, decisions confirmed), `open:` (the open questions, one line each with its recommendation), `next: /opsx:propose <name>`. With no change and no capture request, end by saying the open questions exist only in this conversation and `/opsx:propose` in a new session will not see them.

## Guardrails

- Don't implement, don't auto-capture, don't force structure or a conclusion, don't rush.
- Do visualise, do ground in the codebase, do question assumptions, including your own.
