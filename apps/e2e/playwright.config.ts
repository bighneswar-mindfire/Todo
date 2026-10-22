import { defineConfig } from "@playwright/test";
import {
  API_PORT,
  API_URL,
  E2E_DATABASE_URL,
  E2E_JWT_SECRET,
  WEB_PORT,
  WEB_URL,
} from "./src/env.ts";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Servers start in order. The API command creates and migrates `todo_e2e` first,
  // because Playwright starts web servers before globalSetup would run.
  webServer: [
    {
      command: "node src/prepare-db.mjs && pnpm --filter @todo/backend exec tsx src/server.ts",
      url: `${API_URL}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: "test",
        PORT: String(API_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_SECRET: E2E_JWT_SECRET,
      },
    },
    {
      command: `pnpm --filter @todo/frontend exec vite --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
