---
name: openspec-propose
description: Propose a new OpenSpec change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation. Also use when the user says "openspec propose" or "opsx propose".
allowed-tools: Bash(pnpm exec openspec:*), Read, Write, Edit, Glob, Grep, AskUserQuestion
---

Follow `.claude/commands/opsx/propose.md` exactly, together with the rule files it names in `.claude/rules/`. Use `pnpm exec openspec` for every CLI call. This skill holds no steps of its own, so the workflow is defined in one place.
