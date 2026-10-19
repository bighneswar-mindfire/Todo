import { describe, expect, it } from "vitest";
import { healthSchema, parseEnv } from "./index.js";

describe("shared schemas", () => {
  it("accepts a valid health payload", () => {
    expect(healthSchema.parse({ status: "ok" })).toEqual({ status: "ok" });
  });

  it("rejects an unknown health status", () => {
    expect(() => healthSchema.parse({ status: "down" })).toThrow();
  });

  it("applies env defaults", () => {
    const env = parseEnv({ DATABASE_URL: "postgresql://x" });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects env without DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow();
  });
});
