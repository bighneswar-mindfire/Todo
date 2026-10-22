import { describe, expect, it } from "vitest";
import config from "../playwright.config.ts";
import { uniqueEmail } from "./identity.ts";

const servers = [config.webServer ?? []].flat();

describe("e2e configuration", () => {
  it("E2E run uses its own database", () => {
    const api = servers.find((s) => s.env?.DATABASE_URL);
    expect(api?.env?.DATABASE_URL).toMatch(/\/todo_e2e$/);
    expect(servers[0]?.command).toContain("prepare-db");
    expect(servers.every((s) => s.reuseExistingServer === false)).toBe(true);
  });

  it("Reruns do not collide", () => {
    const emails = new Set(Array.from({ length: 50 }, () => uniqueEmail()));
    expect(emails.size).toBe(50);
    for (const email of emails) expect(email).toMatch(/^[^@\s]+@e2e\.test$/);
  });

  it("Failure evidence is configured", () => {
    expect(config.retries).toBe(0);
    expect(config.use?.trace).toBe("retain-on-failure");
    expect(config.use?.screenshot).toBe("only-on-failure");
    expect(config.outputDir).toBe("./test-results");
  });
});
