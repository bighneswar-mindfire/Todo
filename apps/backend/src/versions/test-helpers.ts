import type { Express } from "express";
import request from "supertest";
import type { NoteVersion, NoteVersionListResponse } from "@todo/shared";
import { auth, type TestUser } from "../notes/test-helpers.js";

export function patchNote(
  app: Express,
  user: TestUser,
  noteId: string,
  body: { title?: string; content?: unknown; autosave?: boolean },
) {
  return request(app).patch(`/notes/${noteId}`).set(auth(user)).send(body);
}

export async function listVersions(app: Express, user: TestUser, noteId: string): Promise<NoteVersionListResponse> {
  const res = await request(app).get(`/notes/${noteId}/versions`).set(auth(user)).expect(200);
  return res.body;
}

export async function getVersion(app: Express, user: TestUser, noteId: string, n: number): Promise<NoteVersion> {
  const res = await request(app).get(`/notes/${noteId}/versions/${n}`).set(auth(user)).expect(200);
  return res.body;
}

export function restoreVersion(app: Express, user: TestUser, noteId: string, n: number | string) {
  return request(app).post(`/notes/${noteId}/versions/${n}/restore`).set(auth(user));
}
