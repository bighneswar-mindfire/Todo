import "dotenv/config";
import { parseEnv, type Env } from "@todo/shared";

/** The single place the backend reads process.env; validated by the shared Zod schema. */
export function loadEnv(): Env {
  return parseEnv(process.env);
}
