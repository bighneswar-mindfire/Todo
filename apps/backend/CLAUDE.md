# Backend

Express 5 + TypeScript (ESM) + Prisma 7.

- `createApp(deps)` in `src/app.ts` builds the app without listening; Supertest imports it directly. `src/server.ts` is the only entry that listens.
- Env is validated by `parseEnv` from `@todo/shared`. Never read `process.env` elsewhere.
- Prisma client is generated to `src/generated/prisma` (gitignored). Run `pnpm generate` after schema changes; `pnpm build` does it automatically. Import the client with the `.js` extension.
- Prisma commands need `--config prisma7.config.ts` (already in the package scripts).
- The first migration is hand-edited: `Note.searchVector` is a generated `tsvector` column. Never regenerate or squash it. Add new migrations with `pnpm migrate:dev --name <name>`.
- Request/response types and Zod schemas come from `@todo/shared`; do not define them here.
- Scope every user-owned query by `userId`. Return 404 (not 403) for other users' resources.
- Tests: Vitest + Supertest, files `src/**/*.test.ts`, one test per spec scenario, named after it. `@todo/shared` resolves to its source in tests.
