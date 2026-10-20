## Conventions

- Model per task: **Haiku** = boilerplate, **Sonnet** = implementation. No Opus work (architecture is settled in design.md).
- `[PARALLEL]` = independent of its sibling tasks. No task is estimated over 45 minutes, so none needs a subagent.
- Test names equal the scenario names in `specs/tags/spec.md` and `specs/notes/spec.md`. Backend tests live in `apps/backend/src/{tags,notes}/`.
- Checkpoint after each phase: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`.

## 1. Shared schemas (`packages/shared`)

- [x] 1.1 (Sonnet) Add `src/tags.ts` (constants, name/color/create/update/param/ref/tag/count/list schemas and types) and export it from `src/index.ts` (D1)
- [x] 1.2 (Haiku) [PARALLEL] Add `TAG_NAME_TAKEN` to `errorCodeSchema` in `src/auth.ts`
- [x] 1.3 (Sonnet) Add `tags` to `noteSchema` and `noteSummarySchema`; rebuild `trashNoteSummarySchema` without `tags`; add `noteListQuerySchema` with optional `tagId` (D1)
- [x] 1.4 (Haiku) Shared tests in `shared.test.ts`: tag name trimmed/bounded, color regex and default, empty update rejected, `TAG_NAME_TAKEN` known, `noteListQuerySchema` rejects non-uuid `tagId`
- [x] 1.5 Checkpoint

## 2. Tag CRUD (backend)

- [x] 2.1 (Haiku) Add `createTag` helper to `notes/test-helpers.ts` (POST `/tags`)
- [x] 2.2 (Sonnet) `tags/tags.service.ts`: `create`, `list`, `update`, `remove` (D3, D4, D5)
- [x] 2.3 (Sonnet) `tags/tags.routes.ts` and mount at `/tags` in `app.ts` (D2)
- [x] 2.4 (Haiku) [PARALLEL] `tags.auth.test.ts`: Missing token rejected
- [x] 2.5 (Haiku) [PARALLEL] `tags.create.test.ts`: Create tag with valid input; Color defaults; Name is trimmed; Empty or overlong name rejected; Invalid color rejected; Duplicate name rejected; Same name allowed for different users
- [x] 2.6 (Haiku) [PARALLEL] `tags.list.test.ts`: List returns only own tags; noteCount counts active notes only
- [x] 2.7 (Haiku) [PARALLEL] `tags.update.test.ts`: Rename and recolor; Empty patch rejected; Rename to existing name rejected; Renaming to its own current name succeeds; Other user's tag hidden on update
- [x] 2.8 (Haiku) [PARALLEL] `tags.delete.test.ts`: Delete tag detaches from notes; Other user's tag hidden on delete; Unknown tag; Malformed tag id rejected
- [x] 2.9 Checkpoint

## 3. Notes: tags exposure, filter, attach/detach (backend)

- [x] 3.1 (Sonnet) `notes.service.ts`: include and flatten ordered `tags` in `toNote` and list summaries; keep trash unchanged (D7)
- [x] 3.2 (Sonnet) `notes.service.ts` + router: `tagId` filter with owner check (404) using `noteListQuerySchema` (D7)
- [x] 3.3 (Sonnet) `tags.service.ts` `attach`/`detach` and notes-router `PUT|DELETE /:id/tags/:tagId`; pass tags service into `createNotesRouter` in `app.ts` (D2, D6)
- [x] 3.4 (Haiku) Update existing note tests that deep-equal note or summary shapes to expect `tags: []`
- [x] 3.5 (Haiku) [PARALLEL] `notes.attach.test.ts`: Attach tag; Attach is idempotent; Other user's tag cannot be attached; Other user's note hidden on attach; Deleted note cannot be tagged; Malformed ids rejected on attach
- [x] 3.6 (Haiku) [PARALLEL] `notes.detach.test.ts`: Detach tag; Detach is idempotent; Other user's note hidden on detach; Deleted note cannot be untagged
- [x] 3.7 (Haiku) [PARALLEL] `notes.list.test.ts` additions: Summaries include tags; Filter by tag; Tag filter excludes deleted notes; Tag filter with other user's tag; Malformed tag filter rejected
- [x] 3.8 (Haiku) [PARALLEL] Notes expose their tags: Get note includes tags (`notes.get`); New note has no tags (`notes.create`); Restore keeps tags (`notes.restore`); Deleting a note keeps its tag (`notes.delete`)
- [x] 3.9 Checkpoint

## 4. Docs and wrap-up

- [x] 4.1 (Haiku) Add an "AB-1005 Tags" section to `apps/backend/CLAUDE.md`
- [x] 4.2 Final checkpoint with `pnpm test --coverage`; confirm every scenario maps to exactly one named test and status codes match `delta-openapi.yaml`
- [x] 4.3 Commits as `feat(tags): ... AB#1005` (one per phase)
