import { z } from "zod";
import { tipTapDocSchema } from "./notes.js";

export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const createShareLinkRequestSchema = z.strictObject({
  expiresAt: z.iso
    .datetime()
    .refine((v) => new Date(v).getTime() > Date.now(), { message: "expiresAt must be in the future" })
    .optional(),
});

export const noteShareParamsSchema = z.object({ id: z.uuid(), shareId: z.uuid() });
export const sharedTokenParamSchema = z.object({ token: z.string().regex(SHARE_TOKEN_PATTERN) });

export const shareLinkSchema = z.object({
  id: z.uuid(),
  noteId: z.uuid(),
  token: z.string().regex(SHARE_TOKEN_PATTERN),
  expiresAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  viewCount: z.number().int().min(0),
  createdAt: z.iso.datetime(),
});
export const shareLinkListResponseSchema = z.object({ items: z.array(shareLinkSchema) });

export const sharedNoteSchema = z.object({
  title: z.string(),
  content: tipTapDocSchema,
  updatedAt: z.iso.datetime(),
});

export type CreateShareLinkRequest = z.infer<typeof createShareLinkRequestSchema>;
export type ShareLink = z.infer<typeof shareLinkSchema>;
export type ShareLinkListResponse = z.infer<typeof shareLinkListResponseSchema>;
export type SharedNote = z.infer<typeof sharedNoteSchema>;
