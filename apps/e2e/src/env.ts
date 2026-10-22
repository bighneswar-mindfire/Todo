import { randomUUID } from "node:crypto";

/** Constants shared by the Playwright config and the database preparation script. */
export const E2E_DB_NAME = "todo_e2e";
/** Defaults to the docker-compose Postgres; set E2E_DB_HOST_URL (no database name) to use another server. */
export const DB_HOST_URL = process.env["E2E_DB_HOST_URL"] ?? "postgresql://todo:todo@localhost:5432";
export const E2E_DATABASE_URL = `${DB_HOST_URL}/${E2E_DB_NAME}`;
export const MAINTENANCE_DATABASE_URL = `${DB_HOST_URL}/postgres`;

/** The frontend dev proxy targets this API port (apps/frontend/src/config/api-proxy.ts). */
export const API_PORT = 3000;
export const WEB_PORT = 5180;
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

/** Throwaway signing secret, regenerated for every run, for the E2E backend only (at least 32 characters). */
export const E2E_JWT_SECRET = `${randomUUID()}${randomUUID()}`;
