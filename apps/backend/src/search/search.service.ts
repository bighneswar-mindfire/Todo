import type { SearchQuery, SearchResponse } from "@todo/shared";
import { AppError } from "../errors.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { excerpt, flattenTags, tagsInclude } from "../notes/summary.js";
import { buildHighlight, MARK_START, MARK_STOP, SENTINELS } from "./highlight.js";

export interface SearchServiceDeps {
  prisma: PrismaClient;
}

export interface SearchService {
  search(userId: string, query: SearchQuery): Promise<SearchResponse>;
}

interface RankedRow {
  id: string;
  rank: number;
}

interface HeadlineRow {
  id: string;
  titleHl: string;
  snippetHl: string;
}

// HighlightAll returns the source text untouched (fragment mode strips tags and short leading words);
// the snippet window is cut in buildHighlight.
const HEADLINE_OPTIONS = `HighlightAll=true,StartSel=${MARK_START},StopSel=${MARK_STOP}`;

export function createSearchService({ prisma }: SearchServiceDeps): SearchService {
  return {
    async search(userId, { q, tagId, page, limit }) {
      if (tagId !== undefined) {
        const tag = await prisma.tag.findFirst({ where: { id: tagId, userId }, select: { id: true } });
        if (!tag) throw new AppError("NOT_FOUND", 404, "Tag not found");
      }

      const tagFilter =
        tagId === undefined
          ? Prisma.empty
          : Prisma.sql`AND EXISTS (SELECT 1 FROM "NoteTag" nt WHERE nt."noteId" = n.id AND nt."tagId" = ${tagId}::uuid)`;
      const matches = Prisma.sql`
        FROM "Note" n
        CROSS JOIN websearch_to_tsquery('english', ${q}::text) AS query
        WHERE n."userId" = ${userId}::uuid
          AND n."deletedAt" IS NULL
          AND n."searchVector" @@ query
          ${tagFilter}`;

      const [ranked, counts] = await prisma.$transaction([
        prisma.$queryRaw<RankedRow[]>`
          SELECT n.id, ts_rank(n."searchVector", query)::float8 AS rank
          ${matches}
          ORDER BY rank DESC, n."updatedAt" DESC, n.id
          LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${matches}`,
      ]);
      const total = counts[0]?.total ?? 0;

      if (ranked.length === 0) return { items: [], page, limit, total };

      const rows = await prisma.note.findMany({
        where: { id: { in: ranked.map((r) => r.id) }, userId },
        select: {
          id: true,
          title: true,
          contentText: true,
          createdAt: true,
          updatedAt: true,
          tags: tagsInclude,
        },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));

      // Headlines only for this page's rows. Sentinels are stripped from the source so note text cannot forge one.
      const headlines = await prisma.$queryRaw<HeadlineRow[]>`
        SELECT n.id,
          ts_headline('english', translate(n.title, ${SENTINELS}, ''), query, ${HEADLINE_OPTIONS}) AS "titleHl",
          ts_headline('english', translate(n."contentText", ${SENTINELS}, ''), query, ${HEADLINE_OPTIONS}) AS "snippetHl"
        FROM "Note" n
        CROSS JOIN websearch_to_tsquery('english', ${q}::text) AS query
        WHERE n.id = ANY(${ranked.map((r) => r.id)}::uuid[])
          AND n."userId" = ${userId}::uuid`;
      const headlineById = new Map(headlines.map((h) => [h.id, h]));

      const items = ranked.flatMap(({ id, rank }) => {
        const r = byId.get(id);
        const h = headlineById.get(id);
        if (!r || !h) return [];
        return [
          {
            id: r.id,
            title: r.title,
            excerpt: excerpt(r.contentText),
            tags: flattenTags(r.tags),
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            rank,
            highlight: buildHighlight(h.titleHl, h.snippetHl, r.contentText),
          },
        ];
      });
      return { items, page, limit, total };
    },
  };
}
