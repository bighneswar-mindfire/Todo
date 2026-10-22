import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { E2E_DATABASE_URL, E2E_DB_NAME, MAINTENANCE_DATABASE_URL } from "./env.ts";

// Plain JavaScript on purpose: no local type declarations (types live in @todo/shared).
// `pg` is a backend dependency; resolve it from there instead of adding a package.
const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url));
const { Client } = backendRequire("pg");

async function ensureDatabase() {
  const client = new Client({ connectionString: MAINTENANCE_DATABASE_URL });
  await client.connect();
  try {
    const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [E2E_DB_NAME]);
    if (!found.rowCount) await client.query(`CREATE DATABASE ${E2E_DB_NAME}`);
  } finally {
    await client.end();
  }
}

// shell: true is needed to launch pnpm on Windows; Prisma prints the host and schema, never the connection string.
function migrate() {
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  execFileSync("pnpm", ["--filter", "@todo/backend", "migrate:deploy"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: "inherit",
    shell: true,
  });
}

await ensureDatabase();
migrate();
