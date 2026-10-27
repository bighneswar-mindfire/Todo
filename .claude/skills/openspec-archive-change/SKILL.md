---
name: openspec-archive-change
description: Archive a completed OpenSpec change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete. Also use when the user says "openspec archive" or "opsx archive".
allowed-tools: Bash(pnpm exec openspec:*), Read, Write, Edit, Glob, Grep
---

Follow `.claude/commands/opsx/archive.md` exactly, with any rule files it names in `.claude/rules/`. Use `pnpm exec openspec` for every CLI call. This skill holds no steps of its own, so the workflow is defined in one place.
