---
name: openspec-sync-specs
description: Sync delta specs from an OpenSpec change to main specs. Use when the user wants to update main specs with changes from a delta spec, without archiving the change. Also use when the user says "openspec sync" or "opsx sync".
allowed-tools: Bash(pnpm exec openspec:*), Read, Write, Edit, Glob, Grep
---

Follow `.claude/commands/opsx/sync.md` exactly, with any rule files it names in `.claude/rules/`. Use `pnpm exec openspec` for every CLI call. This skill holds no steps of its own, so the workflow is defined in one place.
