import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}

export const PRODUCTION_SCRYPT_PARAMS: ScryptParams = { N: 2 ** 16, r: 8, p: 2 };

const SCHEME = "scrypt";
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const MAX_N = 2 ** 20;
const MAX_R = 16;
const MAX_P = 4;
const POSITIVE_INTEGER = /^[1-9]\d{0,9}$/;

function paramsInBounds({ N, r, p }: ScryptParams): boolean {
  return (
    Number.isInteger(N) &&
    Number.isInteger(r) &&
    Number.isInteger(p) &&
    N >= 2 &&
    N <= MAX_N &&
    (N & (N - 1)) === 0 &&
    r >= 1 &&
    r <= MAX_R &&
    p >= 1 &&
    p <= MAX_P
  );
}

function deriveKey(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const { N, r, p } = params;
  return scryptAsync(password, salt, KEY_BYTES, { N, r, p, maxmem: 2 * 128 * N * r });
}

export function createPasswordHasher(params: ScryptParams): PasswordHasher {
  if (!paramsInBounds(params)) {
    throw new RangeError("Invalid scrypt parameters");
  }

  return {
    async hash(password) {
      const salt = randomBytes(SALT_BYTES);
      const key = await deriveKey(password, salt, params);
      const { N, r, p } = params;
      return [
        SCHEME,
        N,
        r,
        p,
        salt.toString("base64url"),
        key.toString("base64url"),
      ].join("$");
    },

    async verify(password, stored) {
      const parts = stored.split("$");
      if (parts.length !== 6 || parts[0] !== SCHEME) return false;
      const [, nStr, rStr, pStr, saltStr, keyStr] = parts as [
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      if (
        !POSITIVE_INTEGER.test(nStr) ||
        !POSITIVE_INTEGER.test(rStr) ||
        !POSITIVE_INTEGER.test(pStr)
      ) {
        return false;
      }
      const parsed: ScryptParams = { N: Number(nStr), r: Number(rStr), p: Number(pStr) };
      if (!paramsInBounds(parsed)) return false;

      const salt = Buffer.from(saltStr, "base64url");
      const expected = Buffer.from(keyStr, "base64url");
      if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false;

      const actual = await deriveKey(password, salt, parsed);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },
  };
}

export function createDummyHash(hasher: PasswordHasher): Promise<string> {
  return hasher.hash(randomBytes(32).toString("base64url"));
}
