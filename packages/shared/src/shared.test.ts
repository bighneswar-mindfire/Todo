import { describe, expect, it } from "vitest";
import {
  createNoteRequestSchema,
  emailSchema,
  errorCodeSchema,
  forgotPasswordRequestSchema,
  healthSchema,
  pageQuerySchema,
  parseEnv,
  registerRequestSchema,
  resetPasswordRequestSchema,
  updateNoteRequestSchema,
  zodIssuesToDetails,
} from "./index.js";

const JWT_SECRET = "s".repeat(32);

describe("shared schemas", () => {
  it("accepts a valid health payload", () => {
    expect(healthSchema.parse({ status: "ok" })).toEqual({ status: "ok" });
  });

  it("rejects an unknown health status", () => {
    expect(() => healthSchema.parse({ status: "down" })).toThrow();
  });

  it("applies env defaults", () => {
    const env = parseEnv({ DATABASE_URL: "postgresql://x", JWT_SECRET });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects env without DATABASE_URL", () => {
    expect(() => parseEnv({ JWT_SECRET })).toThrow();
  });
});

describe("auth: shared schema helpers", () => {
  it("[design] zodIssuesToDetails maps an empty path to body", () => {
    expect(zodIssuesToDetails([{ path: [], message: "bad" }])).toEqual([{ field: "body", message: "bad" }]);
  });

  it("[design] zodIssuesToDetails joins nested paths with a dot", () => {
    const result = registerRequestSchema.safeParse({ email: "nope", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(zodIssuesToDetails(result.error.issues).map((d) => d.field)).toEqual(["email", "password"]);
    }
    expect(zodIssuesToDetails([{ path: ["a", 0, "b"], message: "m" }])[0]?.field).toBe("a.0.b");
  });

  it("[design] email is trimmed and lowercased before format validation", () => {
    expect(emailSchema.parse("  A@B.COM ")).toBe("a@b.com");
    expect(emailSchema.safeParse("  not-an-email ").success).toBe(false);
  });
});

describe("auth: password reset shared schemas", () => {
  const valid = { email: "a@b.com", otp: "012345", newPassword: "longenough" };

  it("[design] otp must be exactly 6 digits", () => {
    expect(resetPasswordRequestSchema.safeParse(valid).success).toBe(true);
    for (const otp of ["12345", "1234567", "12345a", " 12345", "12 345", ""]) {
      expect(resetPasswordRequestSchema.safeParse({ ...valid, otp }).success, otp).toBe(false);
    }
    expect(resetPasswordRequestSchema.safeParse({ ...valid, otp: 123456 }).success).toBe(false);
  });

  it("[design] newPassword is bounded to 8..128 characters", () => {
    const parse = (newPassword: string) =>
      resetPasswordRequestSchema.safeParse({ ...valid, newPassword }).success;
    expect(parse("x".repeat(7))).toBe(false);
    expect(parse("x".repeat(8))).toBe(true);
    expect(parse("x".repeat(128))).toBe(true);
    expect(parse("x".repeat(129))).toBe(false);
  });

  it("[design] forgot and reset emails are normalized", () => {
    expect(forgotPasswordRequestSchema.parse({ email: "  A@B.COM " }).email).toBe("a@b.com");
    expect(resetPasswordRequestSchema.parse({ ...valid, email: " A@B.COM " }).email).toBe("a@b.com");
  });
});

describe("auth: configuration and shared schemas", () => {
  it("Missing secret fails startup", () => {
    const base = { DATABASE_URL: "postgresql://x" };
    expect(() => parseEnv(base)).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...base, JWT_SECRET: "x".repeat(31) })).toThrow(/JWT_SECRET/);
    expect(parseEnv({ ...base, JWT_SECRET }).JWT_SECRET).toBe(JWT_SECRET);
  });
});

describe("shared note schemas", () => {
  const doc = { type: "doc", content: [] };

  it("[design] title bounds are trimmed 1 to 200", () => {
    const ok = (title: string) => createNoteRequestSchema.safeParse({ title, content: doc }).success;
    expect(ok("")).toBe(false);
    expect(ok("   ")).toBe(false);
    expect(ok("a")).toBe(true);
    expect(ok("a".repeat(200))).toBe(true);
    expect(ok("a".repeat(201))).toBe(false);
  });

  it("[design] content must be a doc and defaults to an empty doc", () => {
    expect(createNoteRequestSchema.safeParse({ title: "t", content: { type: "paragraph" } }).success).toBe(false);
    expect(createNoteRequestSchema.safeParse({ title: "t", content: "x" }).success).toBe(false);
    expect(createNoteRequestSchema.parse({ title: "t" }).content).toEqual(doc);
  });

  it("[design] an empty patch is rejected", () => {
    expect(updateNoteRequestSchema.safeParse({}).success).toBe(false);
    expect(updateNoteRequestSchema.safeParse({ title: "x" }).success).toBe(true);
    expect(updateNoteRequestSchema.safeParse({ content: doc }).success).toBe(true);
  });

  it("[design] page and limit coerce, default and are bounded", () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(pageQuerySchema.parse({ page: "2", limit: "100" })).toEqual({ page: 2, limit: 100 });
    expect(pageQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });

  it("[design] NOT_FOUND is a known error code", () => {
    expect(errorCodeSchema.options).toContain("NOT_FOUND");
  });
});
