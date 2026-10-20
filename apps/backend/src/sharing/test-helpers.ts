import type { Express } from "express";
import request from "supertest";
import type { ShareLink } from "@todo/shared";
import { auth, type TestUser } from "../notes/test-helpers.js";

export async function createShare(
  app: Express,
  user: TestUser,
  noteId: string,
  body: { expiresAt?: string } = {},
): Promise<ShareLink> {
  const res = await request(app).post(`/notes/${noteId}/shares`).set(auth(user)).send(body).expect(201);
  return res.body;
}

export async function listShares(app: Express, user: TestUser, noteId: string): Promise<ShareLink[]> {
  const res = await request(app).get(`/notes/${noteId}/shares`).set(auth(user)).expect(200);
  return res.body.items;
}

export function openShared(app: Express, token: string) {
  return request(app).get(`/shared/${token}`);
}

export const inFuture = (ms: number): string => new Date(Date.now() + ms).toISOString();
