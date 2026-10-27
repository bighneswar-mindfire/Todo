---
name: openspec-update-change
description: Update an OpenSpec change by revising its existing planning artifacts and keeping them coherent with one another. Use when the user wants to revise a change's plan, fold new decisions into it, or reconcile its artifacts after an edit. Also use when the user says "openspec update change" or "opsx update". If the user means the openspec update CLI command, which refreshes generated files, run that command instead. Never edits code.
allowed-tools: Bash(pnpm exec openspec:*), Read, Write, Edit, Glob, Grep
---

Follow `.claude/commands/opsx/update.md` exactly, with any rule files it names in `.claude/rules/`. Use `pnpm exec openspec` for every CLI call. This skill holds no steps of its own, so the workflow is defined in one place.
