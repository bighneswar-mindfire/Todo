import { z } from "zod";
import { listMeta, noteSummarySchema, pageQuerySchema } from "./notes.js";

export const SEARCH_QUERY_MAX_LENGTH = 200;

export const searchQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().min(1).max(SEARCH_QUERY_MAX_LENGTH),
  tagId: z.uuid().optional(),
});

export const highlightSchema = z.object({ title: z.string(), snippet: z.string() });

export const searchResultSchema = noteSummarySchema.extend({
  rank: z.number(),
  highlight: highlightSchema,
});

export const searchResponseSchema = z.object({
  items: z.array(searchResultSchema),
  ...listMeta,
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type Highlight = z.infer<typeof highlightSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
