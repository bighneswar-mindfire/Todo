import type { CreateTagRequest, Tag, TagListResponse, UpdateTagRequest } from "@todo/shared";
import { AppError } from "../errors.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";

export interface TagsServiceDeps {
  prisma: PrismaClient;
}

export interface TagsService {
  create(userId: string, input: CreateTagRequest): Promise<Tag>;
  list(userId: string): Promise<TagListResponse>;
  update(userId: string, id: string, input: UpdateTagRequest): Promise<Tag>;
  remove(userId: string, id: string): Promise<void>;
  attach(userId: string, noteId: string, tagId: string): Promise<void>;
  detach(userId: string, noteId: string, tagId: string): Promise<void>;
}

function tagNotFound(): AppError {
  return new AppError("NOT_FOUND", 404, "Tag not found");
}

function noteNotFound(): AppError {
  return new AppError("NOT_FOUND", 404, "Note not found");
}

function nameTaken(): AppError {
  return new AppError("TAG_NAME_TAKEN", 409, "Tag name already in use");
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function toTag(row: { id: string; name: string; color: string; createdAt: Date }): Tag {
  return { id: row.id, name: row.name, color: row.color, createdAt: row.createdAt.toISOString() };
}

export function createTagsService({ prisma }: TagsServiceDeps): TagsService {
  /** Both the active note and the tag must belong to the caller. */
  async function assertOwned(tx: Prisma.TransactionClient, userId: string, noteId: string, tagId: string) {
    const [note, tag] = await Promise.all([
      tx.note.findFirst({ where: { id: noteId, userId, deletedAt: null }, select: { id: true } }),
      tx.tag.findFirst({ where: { id: tagId, userId }, select: { id: true } }),
    ]);
    if (!note) throw noteNotFound();
    if (!tag) throw tagNotFound();
  }

  return {
    async create(userId, { name, color }) {
      try {
        return toTag(await prisma.tag.create({ data: { userId, name, color } }));
      } catch (err) {
        if (isUniqueViolation(err)) throw nameTaken();
        throw err;
      }
    },

    async list(userId) {
      const rows = await prisma.tag.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        include: { _count: { select: { notes: { where: { note: { deletedAt: null } } } } } },
      });
      return { items: rows.map((r) => ({ ...toTag(r), noteCount: r._count.notes })) };
    },

    async update(userId, id, { name, color }) {
      const data: Prisma.TagUpdateManyMutationInput = {};
      if (name !== undefined) data.name = name;
      if (color !== undefined) data.color = color;
      try {
        const { count } = await prisma.tag.updateMany({ where: { id, userId }, data });
        if (count === 0) throw tagNotFound();
      } catch (err) {
        if (isUniqueViolation(err)) throw nameTaken();
        throw err;
      }
      const row = await prisma.tag.findFirst({ where: { id, userId } });
      if (!row) throw tagNotFound();
      return toTag(row);
    },

    async remove(userId, id) {
      const { count } = await prisma.tag.deleteMany({ where: { id, userId } });
      if (count === 0) throw tagNotFound();
    },

    async attach(userId, noteId, tagId) {
      await prisma.$transaction(async (tx) => {
        await assertOwned(tx, userId, noteId, tagId);
        await tx.noteTag.createMany({ data: [{ noteId, tagId }], skipDuplicates: true });
      });
    },

    async detach(userId, noteId, tagId) {
      await prisma.$transaction(async (tx) => {
        await assertOwned(tx, userId, noteId, tagId);
        await tx.noteTag.deleteMany({ where: { noteId, tagId } });
      });
    },
  };
}
