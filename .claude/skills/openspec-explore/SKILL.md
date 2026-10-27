---
name: openspec-explore
description: Enter OpenSpec explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements in a project that uses OpenSpec. Use when the user wants to think through something before or during an OpenSpec change. Also use when the user says "openspec explore" or "opsx explore".
allowed-tools: Bash(pnpm exec openspec:*), Read, Write, Edit, Glob, Grep
---

Follow `.claude/commands/opsx/explore.md` exactly, with any rule files it names in `.claude/rules/`. Use `pnpm exec openspec` for every CLI call. This skill holds no steps of its own, so the workflow is defined in one place.
