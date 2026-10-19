# Frontend

React 19 + TypeScript + Vite. Currently a skeleton; app features start at AB-1010.

- Server state: TanStack Query. Client state: Zustand. Editor: TipTap. UI: shadcn/ui. Add each only in the ticket that needs it.
- Types and Zod schemas come from `@todo/shared`; never redefine API types here.
- Tests: Vitest + Testing Library (jsdom), files `src/**/*.test.tsx`. Playwright E2E arrives in AB-1016.
- Hooks rules are enforced by ESLint (`eslint-plugin-react-hooks`), zero warnings.
