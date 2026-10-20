import { z } from "zod";

export const TAG_NAME_MAX = 50;
export const DEFAULT_TAG_COLOR = "#6b7280";

export const tagNameSchema = z.string().trim().min(1).max(TAG_NAME_MAX);
export const tagColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const createTagRequestSchema = z.object({
  name: tagNameSchema,
  color: tagColorSchema.default(DEFAULT_TAG_COLOR),
});

export const updateTagRequestSchema = z
  .object({
    name: tagNameSchema.optional(),
    color: tagColorSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined, {
    message: "At least one of name or color is required",
  });

export const tagIdParamSchema = z.object({ id: z.uuid() });
export const noteTagParamsSchema = z.object({ id: z.uuid(), tagId: z.uuid() });

export const tagRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string(),
});

export const tagSchema = tagRefSchema.extend({ createdAt: z.iso.datetime() });
export const tagWithCountSchema = tagSchema.extend({ noteCount: z.number().int().min(0) });
export const tagListResponseSchema = z.object({ items: z.array(tagWithCountSchema) });

export type CreateTagRequest = z.infer<typeof createTagRequestSchema>;
export type UpdateTagRequest = z.infer<typeof updateTagRequestSchema>;
export type TagRef = z.infer<typeof tagRefSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type TagWithCount = z.infer<typeof tagWithCountSchema>;
export type TagListResponse = z.infer<typeof tagListResponseSchema>;
