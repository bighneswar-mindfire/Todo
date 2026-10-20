import { randomBytes } from "node:crypto";

/** 32 random bytes as base64url: 43 characters, 256 bits. Bearer secret, never log it. */
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}
