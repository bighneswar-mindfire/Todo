import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { createApp } from "../app.js";
import { createPrisma, prismaPing } from "../db.js";
import { loadEnv } from "../env.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { createPasswordHasher, type PasswordHasher } from "./password.js";

export const TEST_JWT_SECRET = "test-secret-test-secret-test-secret-0123";
export const TEST_EMAIL_DOMAIN = "example.test";

export interface TestApp {
  app: Express;
  prisma: PrismaClient;
  hasher: PasswordHasher;
  close: () => Promise<void>;
}

export function buildTestApp(): TestApp {
  const prisma = createPrisma(loadEnv().DATABASE_URL);
  const hasher = createPasswordHasher({ N: 1024, r: 8, p: 1 });
  const app = createApp({
    ping: prismaPing(prisma),
    prisma,
    hasher,
    jwt: { secret: TEST_JWT_SECRET },
  });
  return { app, prisma, hasher, close: () => prisma.$disconnect() };
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
