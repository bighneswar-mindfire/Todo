import { z } from "zod";
import { tagRefSchema } from "./tags.js";

export const TRASH_RETENTION_DAYS = 30;
export const NOTE_EXCERPT_LENGTH = 200;

export const tipTapDocSchema = z.looseObject({
  type: z.literal("doc"),
  content: z.array(z.looseObject({})).optional(),
});

const titleSchema = z.string().trim().min(1).max(200);

export const createNoteRequestSchema = z.object({
  title: titleSchema,
  content: tipTapDocSchema.default(() => ({ type: "doc" as const, content: [] })),
});

export const updateNoteRequestSchema = z
  .object({
    title: titleSchema.optional(),
    content: tipTapDocSchema.optional(),
    autosave: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, {
    message: "At least one of title or content is required",
  });

export const noteIdParamSchema = z.object({ id: z.uuid() });

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const noteListQuerySchema = pageQuerySchema.extend({ tagId: z.uuid().optional() });

export const noteSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  content: tipTapDocSchema,
  tags: z.array(tagRefSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});

const noteSummaryBase = z.object({
  id: z.uuid(),
  title: z.string(),
  excerpt: z.string().max(NOTE_EXCERPT_LENGTH),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const noteSummarySchema = noteSummaryBase.extend({ tags: z.array(tagRefSchema) });

export const trashNoteSummarySchema = noteSummaryBase.extend({
  deletedAt: z.iso.datetime(),
});

export const listMeta = { page: z.number().int(), limit: z.number().int(), total: z.number().int() };

export const noteListResponseSchema = z.object({ items: z.array(noteSummarySchema), ...listMeta });
export const trashListResponseSchema = z.object({
  items: z.array(trashNoteSummarySchema),
  ...listMeta,
});

export type TipTapDoc = z.infer<typeof tipTapDocSchema>;
export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>;
export type UpdateNoteRequest = z.infer<typeof updateNoteRequestSchema>;
export type PageQuery = z.infer<typeof pageQuerySchema>;
export type NoteListQuery = z.infer<typeof noteListQuerySchema>;
export type Note = z.infer<typeof noteSchema>;
export type NoteSummary = z.infer<typeof noteSummarySchema>;
export type TrashNoteSummary = z.infer<typeof trashNoteSummarySchema>;
export type NoteListResponse = z.infer<typeof noteListResponseSchema>;
export type TrashListResponse = z.infer<typeof trashListResponseSchema>;
