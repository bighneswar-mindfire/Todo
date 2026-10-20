import { z } from "zod";
import { NOTE_EXCERPT_LENGTH, listMeta, tipTapDocSchema } from "./notes.js";

export const versionNumberParamSchema = z.object({
  id: z.uuid(),
  versionNumber: z.coerce.number().int().min(1),
});

export const noteVersionSummarySchema = z.object({
  id: z.uuid(),
  versionNumber: z.number().int().min(1),
  title: z.string(),
  excerpt: z.string().max(NOTE_EXCERPT_LENGTH),
  createdAt: z.iso.datetime(),
});

export const noteVersionListResponseSchema = z.object({
  items: z.array(noteVersionSummarySchema),
  ...listMeta,
});

export const noteVersionSchema = z.object({
  id: z.uuid(),
  noteId: z.uuid(),
  versionNumber: z.number().int().min(1),
  title: z.string(),
  content: tipTapDocSchema,
  createdAt: z.iso.datetime(),
});

export type VersionNumberParams = z.infer<typeof versionNumberParamSchema>;
export type NoteVersionSummary = z.infer<typeof noteVersionSummarySchema>;
export type NoteVersionListResponse = z.infer<typeof noteVersionListResponseSchema>;
export type NoteVersion = z.infer<typeof noteVersionSchema>;
