import { randomUUID } from "node:crypto";

/** A password that satisfies the shared registration schema. */
export const E2E_PASSWORD = "E2e-Passw0rd!";

/** An email no earlier run has used, so reruns need no database cleanup. */
export function uniqueEmail(): string {
  return `user-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}@e2e.test`;
}
