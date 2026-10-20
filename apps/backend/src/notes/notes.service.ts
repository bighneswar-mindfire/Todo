import {
  TRASH_RETENTION_DAYS,
  type CreateNoteRequest,
  type Note,
  type NoteListResponse,
  type NoteListQuery,
  type PageQuery,
  type TipTapDoc,
  type TrashListResponse,
  type UpdateNoteRequest,
} from "@todo/shared";
import { AppError } from "../errors.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { extractText } from "./content-text.js";
import { excerpt, flattenTags, tagsInclude, type TagLinks } from "./summary.js";

export interface NotesServiceDeps {
  prisma: PrismaClient;
}

export interface NotesService {
  create(userId: string, input: CreateNoteRequest): Promise<Note>;
  list(userId: string, query: NoteListQuery): Promise<NoteListResponse>;
  get(userId: string, id: string): Promise<Note>;
  update(userId: string, id: string, input: UpdateNoteRequest): Promise<Note>;
  softDelete(userId: string, id: string): Promise<void>;
  listTrash(userId: string, page: PageQuery): Promise<TrashListResponse>;
  restore(userId: string, id: string): Promise<Note>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function notFound(): AppError {
  return new AppError("NOT_FOUND", 404, "Note not found");
}

function toJson(doc: TipTapDoc): Prisma.InputJsonValue {
  return doc as Prisma.InputJsonValue;
}

function toNote(row: {
  id: string;
  title: string;
  content: Prisma.JsonValue;
  tags: TagLinks;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content as TipTapDoc,
    tags: flattenTags(row.tags),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

function restoreCutoff(): Date {
  return new Date(Date.now() - TRASH_RETENTION_DAYS * DAY_MS);
}

export function createNotesService({ prisma }: NotesServiceDeps): NotesService {
  async function findOwned(userId: string, id: string): Promise<Note> {
    const row = await prisma.note.findFirst({
      where: { id, userId },
      include: { tags: tagsInclude },
    });
    if (!row) throw notFound();
    return toNote(row);
  }

  return {
    async create(userId, { title, content }) {
      const row = await prisma.note.create({
        data: { userId, title, content: toJson(content), contentText: extractText(content) },
      });
      return toNote({ ...row, tags: [] });
    },

    async list(userId, { page, limit, tagId }) {
      if (tagId !== undefined) {
        const tag = await prisma.tag.findFirst({ where: { id: tagId, userId }, select: { id: true } });
        if (!tag) throw new AppError("NOT_FOUND", 404, "Tag not found");
      }
      const where: Prisma.NoteWhereInput = {
        userId,
        deletedAt: null,
        ...(tagId !== undefined ? { tags: { some: { tagId } } } : {}),
      };
      const [rows, total] = await prisma.$transaction([
        prisma.note.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            title: true,
            contentText: true,
            createdAt: true,
            updatedAt: true,
            tags: tagsInclude,
          },
        }),
        prisma.note.count({ where }),
      ]);
      return {
        items: rows.map((r) => ({
          id: r.id,
          title: r.title,
          excerpt: excerpt(r.contentText),
          tags: flattenTags(r.tags),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        page,
        limit,
        total,
      };
    },

    async get(userId, id) {
      const row = await prisma.note.findFirst({
        where: { id, userId, deletedAt: null },
        include: { tags: tagsInclude },
      });
      if (!row) throw notFound();
      return toNote(row);
    },

    async update(userId, id, { title, content }) {
      const data: Prisma.NoteUpdateManyMutationInput = {};
      if (title !== undefined) data.title = title;
      if (content !== undefined) {
        data.content = toJson(content);
        data.contentText = extractText(content);
      }
      const { count } = await prisma.note.updateMany({
        where: { id, userId, deletedAt: null },
        data,
      });
      if (count === 0) throw notFound();
      return findOwned(userId, id);
    },

    async softDelete(userId, id) {
      const { count } = await prisma.note.updateMany({
        where: { id, userId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (count === 0) throw notFound();
    },

    async listTrash(userId, { page, limit }) {
      const where = { userId, deletedAt: { gte: restoreCutoff() } };
      const [rows, total] = await prisma.$transaction([
        prisma.note.findMany({
          where,
          orderBy: { deletedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            title: true,
            contentText: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
        }),
        prisma.note.count({ where }),
      ]);
      return {
        items: rows.map((r) => ({
          id: r.id,
          title: r.title,
          excerpt: excerpt(r.contentText),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          deletedAt: (r.deletedAt as Date).toISOString(),
        })),
        page,
        limit,
        total,
      };
    },

    async restore(userId, id) {
      const { count } = await prisma.note.updateMany({
        where: { id, userId, deletedAt: { gte: restoreCutoff() } },
        data: { deletedAt: null },
      });
      if (count === 0) throw notFound();
      return findOwned(userId, id);
    },
  };
}
