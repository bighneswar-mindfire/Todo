# Shared

The only place for TypeScript types and Zod schemas (`@todo/shared`). Backend and frontend import from here; never duplicate or redefine them in an app.

## Layout

- One file per area in `src/`: `auth` (also the error envelope and codes), `notes` (TipTap doc, list paging, trash), `tags`, `search`, `sharing`, `versions`, `env`, `health`. A new area is a new file plus one `export *` line in `src/index.ts`.
- Export everything through `src/index.ts`. Use `.js` extensions in relative imports (ESM).
- Built with `tsc` to `dist`. Apps resolve the built output in `pnpm build` and the source in backend tests (a Vitest alias). The frontend consumes `dist/`, so run `pnpm --filter @todo/shared build` after changing anything here before building or testing it.
- Tests live in `src/shared.test.ts` (Vitest, 80% thresholds). Add a test for every schema rule that has a boundary.

## Schemas and types

- Zod 4, exact version pinned in `package.json`. Use its top-level formats: `z.uuid()`, `z.email()`, `z.iso.datetime()`.
- Derive every type with `z.infer`; never hand-write a type a schema already defines. Use `z.input` only for a form's pre-parse shape (see `CreateTagRequestInput`).
- Name schemas `<thing>Schema`, request bodies `<action><Thing>RequestSchema`, responses `<thing>ResponseSchema`, route params `<thing>ParamSchema(s)`; the type drops the `Schema` suffix.
- Strings that users type are `trim()`med and bounded (`min`/`max`); emails are also lower-cased. Put a limit in an exported constant (`TAG_NAME_MAX`, `NOTE_EXCERPT_LENGTH`, `TRASH_RETENTION_DAYS`) when both apps need the number.
- Timestamps cross the wire as ISO strings (`z.iso.datetime()`), ids as UUID strings, never `Date` objects.
- A partial update uses optional fields plus a `refine` that requires at least one.
- Query and param schemas that read strings use `z.coerce` with defaults and bounds (`pageQuerySchema`: page at least 1, limit 1 to 100).
- Response schemas are what the frontend validates; keep them exact (no secrets such as password hashes or token hashes in any schema).
- `tipTapDocSchema` is deliberately loose (`z.looseObject`) because the editor owns the document shape; do not tighten it here.
- Use `z.strictObject` only where an unknown key must be an error (the share-link request).

## Errors

- Every failure body is `{ error: { code, message, details? } }` (`errorResponseSchema`). `details` is `{ field, message }[]` built by `zodIssuesToDetails`.
- `errorCodeSchema` lists every code the backend may send; `clientErrorCodeSchema` lists codes only the frontend produces (`NETWORK_ERROR`). Add a code to the right enum in the same change as the status code that uses it in the change's `delta-openapi.yaml`.

## Env

- `parseEnv` is the only reader of the process environment. A new variable is added to `envSchema` with a default only when a safe default exists; secrets have a minimum length and no default.

## Changing the contract

- Contract first: change the schema here, then the API, then the UI, in that order and in the same change as the spec and `delta-openapi.yaml`.
- Additive changes (a new optional field, a new schema, a new error code) do not break existing callers. Renaming or removing a field, making an optional field required, narrowing a limit or changing a status/error code breaks callers: update backend and frontend in the same change, and never leave one app on the old shape.
- Do not bump `version` in `package.json`; the package is private and consumed from the workspace. Dependency versions stay exact, never `latest`.
- Do not import from `apps/*` here, and keep runtime dependencies to `zod`.
