import { randomUUID } from "node:crypto";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../app.js";
import { createPrisma, prismaPing } from "../db.js";
import { loadEnv } from "../env.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { type OtpSender } from "./otp.js";
import { createPasswordHasher, type PasswordHasher } from "./password.js";

export const TEST_JWT_SECRET = "test-secret-test-secret-test-secret-0123";
export const TEST_EMAIL_DOMAIN = "example.test";

export interface SentOtp {
  email: string;
  otp: string;
}

export interface TestApp {
  app: Express;
  sentOtps: SentOtp[];
  /** The newest OTP the capturing sender received for this email. */
  lastOtpFor: (email: string) => string;
  prisma: PrismaClient;
  hasher: PasswordHasher;
  close: () => Promise<void>;
}

export interface BuildTestAppOptions {
  /** Replaces the capturing sender (for example to exercise the default console sender). */
  otpSender?: OtpSender | "default";
}

export function buildTestApp({ otpSender }: BuildTestAppOptions = {}): TestApp {
  const sentOtps: SentOtp[] = [];
  const capturing: OtpSender = { send: (email, otp) => void sentOtps.push({ email, otp }) };
  const prisma = createPrisma(loadEnv().DATABASE_URL);
  const hasher = createPasswordHasher({ N: 1024, r: 8, p: 1 });
  const app = createApp({
    ping: prismaPing(prisma),
    prisma,
    hasher,
    jwt: { secret: TEST_JWT_SECRET },
    ...(otpSender === "default" ? {} : { otpSender: otpSender ?? capturing }),
  });
  const lastOtpFor = (email: string): string => {
    const hit = [...sentOtps].reverse().find((s) => s.email === email);
    if (!hit) throw new Error(`no OTP was sent to ${email}`);
    return hit.otp;
  };
  return { app, sentOtps, lastOtpFor, prisma, hasher, close: () => prisma.$disconnect() };
}

// One id per module instance (per test file worker), so parallel files never delete each other's users.
const RUN_ID = randomUUID();
const EMAIL_PREFIX = `test-${RUN_ID}-`;

export function uniqueEmail(): string {
  return `${EMAIL_PREFIX}${randomUUID()}@${TEST_EMAIL_DOMAIN}`;
}

/** Deletes the users this test file created; their refresh tokens cascade. */
export async function cleanupUsers(prisma: PrismaClient): Promise<void> {
  await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX, endsWith: `@${TEST_EMAIL_DOMAIN}` } },
  });
}

export const TEST_PASSWORD = "correct horse battery";

/** Registers a fresh user through the API and returns its email. */
export async function registerUser(app: Express, password = TEST_PASSWORD): Promise<string> {
  const email = uniqueEmail();
  await request(app).post("/auth/register").send({ email, password }).expect(201);
  return email;
}
