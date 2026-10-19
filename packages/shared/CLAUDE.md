# Shared

The only place for TypeScript types and Zod schemas (`@todo/shared`). Backend and frontend import from here; never duplicate.

- Export everything through `src/index.ts`. Use `.js` extensions in relative imports (ESM).
- Derive types with `z.infer`; do not hand-write a type that a schema already defines.
- Built with `tsc` to `dist`. Apps resolve the built output in `pnpm build` and the source in tests.
