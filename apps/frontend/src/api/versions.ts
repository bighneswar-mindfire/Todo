import {
  noteSchema,
  noteVersionListResponseSchema,
  noteVersionSchema,
  versionNumberParamSchema,
  type Note,
  type NoteVersion,
  type NoteVersionListResponse,
} from "@todo/shared";
import { request } from "./client";

export function listVersions(noteId: string, page: number, limit: number): Promise<NoteVersionListResponse> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return request(`/notes/${noteId}/versions?${query.toString()}`, {
    auth: "bearer",
    schema: noteVersionListResponseSchema,
  });
}

/** Rejects (without a request) when `versionNumber` is not an integer of at least 1. */
export async function getVersion(noteId: string, versionNumber: number): Promise<NoteVersion> {
  const params = versionNumberParamSchema.parse({ id: noteId, versionNumber });
  return request(`/notes/${params.id}/versions/${params.versionNumber}`, {
    auth: "bearer",
    schema: noteVersionSchema,
  });
}

/** Copies the version onto the note as a new version. Rejects (without a request) on a bad version number. */
export async function restoreVersion(noteId: string, versionNumber: number): Promise<Note> {
  const params = versionNumberParamSchema.parse({ id: noteId, versionNumber });
  return request(`/notes/${params.id}/versions/${params.versionNumber}/restore`, {
    method: "POST",
    auth: "bearer",
    schema: noteSchema,
  });
}
