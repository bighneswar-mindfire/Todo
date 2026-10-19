import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

const OTP_DIGITS = 6;
const HASH_DOMAIN = "password-reset-otp";

/** The only seam through which a raw OTP leaves the service; swapped in tests. */
export interface OtpSender {
  send(email: string, otp: string): void;
}

export const consoleOtpSender: OtpSender = {
  send(email, otp) {
    console.log(`[password-reset] OTP for ${email}: ${otp}`);
  },
};

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_DIGITS)).padStart(OTP_DIGITS, "0");
}

export function hashOtp(otp: string, userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${HASH_DOMAIN}:${userId}:${otp}`).digest("hex");
}

export function verifyOtp(otp: string, userId: string, secret: string, storedHash: string): boolean {
  const actual = Buffer.from(hashOtp(otp, userId, secret), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
