import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  randomInt: vi.fn(),
  realRandomInt: undefined as unknown as (...args: unknown[]) => number,
}));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  mocks.realRandomInt = actual.randomInt as unknown as typeof mocks.realRandomInt;
  return { ...actual, randomInt: (...args: unknown[]) => mocks.randomInt(...args) };
});

import { generateOtp, hashOtp, verifyOtp } from "./otp.js";
const randomIntMock = mocks.randomInt;

const SECRET = "test-secret-test-secret-test-secret-0123";
const USER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  randomIntMock.mockReset();
  randomIntMock.mockImplementation(mocks.realRandomInt);
});

describe("auth: otp helpers", () => {
  it("[design] generateOtp is always 6 digits, including leading zeros", () => {
    randomIntMock.mockReturnValueOnce(0).mockReturnValueOnce(42).mockReturnValueOnce(999_999);
    expect(generateOtp()).toBe("000000");
    expect(generateOtp()).toBe("000042");
    expect(generateOtp()).toBe("999999");
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it("[design] generateOtp draws from [0, 1_000_000)", () => {
    generateOtp();
    expect(randomIntMock).toHaveBeenCalledWith(0, 1_000_000);
  });

  it("[design] hashOtp is deterministic and depends on code, user and secret", () => {
    const base = hashOtp("123456", USER, SECRET);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtp("123456", USER, SECRET)).toBe(base);
    expect(hashOtp("123457", USER, SECRET)).not.toBe(base);
    expect(hashOtp("123456", "22222222-2222-4222-8222-222222222222", SECRET)).not.toBe(base);
    expect(hashOtp("123456", USER, `${SECRET}x`)).not.toBe(base);
    expect(base).not.toContain("123456");
  });

  it("[design] verifyOtp accepts a match and rejects mismatches and malformed hashes", () => {
    const stored = hashOtp("123456", USER, SECRET);
    expect(verifyOtp("123456", USER, SECRET, stored)).toBe(true);
    expect(verifyOtp("654321", USER, SECRET, stored)).toBe(false);
    expect(verifyOtp("123456", USER, SECRET, "")).toBe(false);
    expect(verifyOtp("123456", USER, SECRET, "not-hex")).toBe(false);
    expect(verifyOtp("123456", USER, SECRET, stored.slice(0, 10))).toBe(false);
  });
});
