import { scrypt } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRODUCTION_SCRYPT_PARAMS,
  createDummyHash,
  createPasswordHasher,
} from "./password.js";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, scrypt: vi.fn(actual.scrypt) };
});

const CHEAP = { N: 1024, r: 8, p: 1 };
const hasher = createPasswordHasher(CHEAP);

beforeEach(() => {
  vi.mocked(scrypt).mockClear();
});

describe("password hasher", () => {
  it("[design] round trip: a hashed password verifies", async () => {
    const stored = await hasher.hash("correct horse battery staple");
    expect(stored.startsWith("scrypt$1024$8$1$")).toBe(true);
    expect(await hasher.verify("correct horse battery staple", stored)).toBe(true);
  });

  it("[design] wrong password does not verify", async () => {
    const stored = await hasher.hash("correct horse battery staple");
    expect(await hasher.verify("wrong password", stored)).toBe(false);
  });

  it("[design] out-of-range params return false without throwing or calling scrypt", async () => {
    const stored = await hasher.hash("secret-password");
    const [, , , , salt, key] = stored.split("$");
    const bad = [
      `scrypt$${2 ** 21}$8$1$${salt}$${key}`,
      "scrypt$1000$8$1$" + `${salt}$${key}`,
      `scrypt$1$8$1$${salt}$${key}`,
      `scrypt$1024$17$1$${salt}$${key}`,
      `scrypt$1024$8$5$${salt}$${key}`,
      `scrypt$1024$0$1$${salt}$${key}`,
      `scrypt$1024$8$0$${salt}$${key}`,
      `scrypt$1024.5$8$1$${salt}$${key}`,
      `scrypt$-1024$8$1$${salt}$${key}`,
    ];
    vi.mocked(scrypt).mockClear();
    for (const value of bad) {
      await expect(hasher.verify("secret-password", value)).resolves.toBe(false);
    }
    expect(scrypt).not.toHaveBeenCalled();
  });

  it("[design] corrupt or foreign stored hashes return false without throwing or calling scrypt", async () => {
    const stored = await hasher.hash("secret-password");
    const [scheme, n, r, p, salt, key] = stored.split("$");
    const corrupt = [
      "",
      "not-a-hash",
      "$2b$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz0123456",
      `bcrypt$${n}$${r}$${p}$${salt}$${key}`,
      `${scheme}$${n}$${r}$${p}$${salt}`,
      `${stored}$extra`,
      `${scheme}$${n}$${r}$${p}$$${key}`,
      `${scheme}$${n}$${r}$${p}$${salt}$`,
      `${scheme}$${n}$${r}$${p}$${salt}$${key?.slice(0, 10)}`,
      `${scheme}$${n}$${r}$${p}$${salt?.slice(0, 4)}$${key}`,
      `${scheme}$abc$${r}$${p}$${salt}$${key}`,
    ];
    vi.mocked(scrypt).mockClear();
    for (const value of corrupt) {
      await expect(hasher.verify("secret-password", value)).resolves.toBe(false);
    }
    expect(scrypt).not.toHaveBeenCalled();
  });

  it("[design] two hashes of the same password differ", async () => {
    const a = await hasher.hash("same-password");
    const b = await hasher.hash("same-password");
    expect(a).not.toBe(b);
    expect(await hasher.verify("same-password", a)).toBe(true);
    expect(await hasher.verify("same-password", b)).toBe(true);
  });

  it("[design] createDummyHash returns a well-formed hash from the injected hasher", async () => {
    const dummy = await createDummyHash(hasher);
    expect(dummy.startsWith("scrypt$1024$8$1$")).toBe(true);
    expect(await hasher.verify("anything", dummy)).toBe(false);
  });

  it("[design] production params hash verifies once", async () => {
    const production = createPasswordHasher(PRODUCTION_SCRYPT_PARAMS);
    const stored = await production.hash("production-password");
    expect(stored.startsWith("scrypt$65536$8$2$")).toBe(true);
    expect(await production.verify("production-password", stored)).toBe(true);
  }, 15_000);
});
