import {
  createShareLinkRequestSchema,
  shareLinkListResponseSchema,
  shareLinkSchema,
  sharedNoteSchema,
  type ShareLink,
  type SharedNote,
} from "@todo/shared";
import { request } from "./client";

/** Creates a link. With no expiry no body is sent (the server treats a missing body as `{}`). */
export function createShareLink(noteId: string, expiresAt?: string): Promise<ShareLink> {
  return request(`/notes/${noteId}/shares`, {
    method: "POST",
    auth: "bearer",
    ...(expiresAt !== undefined ? { body: createShareLinkRequestSchema.parse({ expiresAt }) } : {}),
    schema: shareLinkSchema,
  });
}

export async function listShareLinks(noteId: string): Promise<ShareLink[]> {
  const response = await request(`/notes/${noteId}/shares`, { auth: "bearer", schema: shareLinkListResponseSchema });
  return response.items;
}

export function revokeShareLink(noteId: string, shareId: string): Promise<void> {
  return request(`/notes/${noteId}/shares/${shareId}`, { method: "DELETE", auth: "bearer" });
}

/** Public: no credentials, never refreshes a session. The caller validates the token shape first. */
export function getSharedNote(token: string): Promise<SharedNote> {
  return request(`/shared/${token}`, { auth: "none", retryOn401: false, schema: sharedNoteSchema });
}
