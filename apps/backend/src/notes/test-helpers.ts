import type { Express } from "express";
import request from "supertest";
import type { PrismaClient } from "../generated/prisma/client.js";
import { TEST_PASSWORD, registerUser } from "../auth/test-helpers.js";

export interface TestUser {
  email: string;
  userId: string;
  token: string;
}

export const DOC = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** Registers and logs in a fresh user through the API. */
export async function registerAndLogin(app: Express): Promise<TestUser> {
  const email = await registerUser(app);
  const res = await request(app).post("/auth/login").send({ email, password: TEST_PASSWORD }).expect(200);
  return { email, userId: res.body.user.id, token: res.body.accessToken };
}

export function auth(user: TestUser): { Authorization: string } {
  return { Authorization: `Bearer ${user.token}` };
}

export async function createNote(
  app: Express,
  user: TestUser,
  body: { title?: string; content?: unknown } = {},
): Promise<{ id: string; [k: string]: unknown }> {
  const res = await request(app)
    .post("/notes")
    .set(auth(user))
    .send({ title: "A note", content: DOC("body"), ...body })
    .expect(201);
  return res.body;
}

export async function createTag(
  app: Express,
  user: TestUser,
  body: { name?: string; color?: string } = {},
): Promise<{ id: string; name: string; color: string; [k: string]: unknown }> {
  const res = await request(app)
    .post("/tags")
    .set(auth(user))
    .send({ name: `tag-${Math.random().toString(36).slice(2, 10)}`, ...body })
    .expect(201);
  return res.body;
}

export async function attachTag(app: Express, user: TestUser, noteId: string, tagId: string): Promise<void> {
  await request(app).put(`/notes/${noteId}/tags/${tagId}`).set(auth(user)).expect(204);
}

/** Soft deletes through Prisma with an arbitrary age, to simulate the 30-day window. */
export async function setDeletedAt(prisma: PrismaClient, id: string, daysAgo: number): Promise<void> {
  await prisma.note.update({ where: { id }, data: { deletedAt: new Date(Date.now() - daysAgo * 86_400_000) } });
}
