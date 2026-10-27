# Layout and vocabulary

One layout, one vocabulary. Commands, specs, tasks and agents use these names and no others.

| Layer | Path | Layer rules | Branch domain | Task tag |
|-------|------|-------------|---------------|----------|
| Shared contract | `packages/shared` | `packages/shared/CLAUDE.md` | `shared` | `[shared]` |
| Backend (Express API) | `apps/backend` | `apps/backend/CLAUDE.md` | `backend` | `[backend]` |
| Frontend (React SPA) | `apps/frontend` | `apps/frontend/CLAUDE.md` | `frontend` | `[frontend]` |
| End-to-end | `apps/e2e` | `apps/e2e/README.md` | `e2e` | `[e2e]` |
| Repo checks | `packages/repo-checks` | none | `repo` | `[repo]` |
| Docs and OpenSpec | `docs/`, `openspec/`, `.claude/` | none | `docs` | `[docs]` |

- There is no `apps/web` and no `apps/api`. Say "backend" and "frontend", never "API app" or "web app". The word "API" means the HTTP contract (`delta-openapi.yaml`, SDS section 4), not a directory.
- Each layer's `CLAUDE.md` sits in its own `apps/<layer>/` or `packages/<layer>/` folder. Before touching a layer, read its `CLAUDE.md`.
- Dependency order for tasks: `[shared]` then `[backend]` and `[frontend]` (parallel after shared is committed) then `[e2e]` then `[docs]`.
- Worktree names follow the layer: `git worktree add ../todo-backend -b feature/backend/AB-1042-<short-name>`.
- Paths in specs, designs and tasks are repo-relative and start with one of the folders above.
