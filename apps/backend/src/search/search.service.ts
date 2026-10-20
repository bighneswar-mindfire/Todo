import type { SearchQuery, SearchResponse } from "@todo/shared";
import { AppError } from "../errors.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { excerpt, flattenTags, tagsInclude } from "../notes/summary.js";

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

      const items = ranked.flatMap(({ id, rank }) => {
        const r = byId.get(id);
        if (!r) return [];
        return [
          {
            id: r.id,
            title: r.title,
            excerpt: excerpt(r.contentText),
            tags: flattenTags(r.tags),
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            rank,
          },
        ];
      });
      return { items, page, limit, total };
    },
  };
}
