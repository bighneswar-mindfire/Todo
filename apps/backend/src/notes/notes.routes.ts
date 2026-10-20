import { Router, type RequestHandler } from "express";
import {
  createNoteRequestSchema,
  createShareLinkRequestSchema,
  noteIdParamSchema,
  noteListQuerySchema,
  noteShareParamsSchema,
  noteTagParamsSchema,
  pageQuerySchema,
  updateNoteRequestSchema,
  versionNumberParamSchema,
} from "@todo/shared";
import { parseBody, parseParams, parseQuery } from "../http/parse.js";
import type { SharingService } from "../sharing/sharing.service.js";
import type { TagsService } from "../tags/tags.service.js";
import type { VersionsService } from "../versions/versions.service.js";
import type { NotesService } from "./notes.service.js";

export function createNotesRouter(
  service: NotesService,
  tags: TagsService,
  sharing: SharingService,
  versions: VersionsService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  router.post("/", async (req, res) => {
    const note = await service.create(req.auth!.userId, parseBody(createNoteRequestSchema, req.body));
    res.status(201).json(note);
  });

  router.get("/", async (req, res) => {
    res.status(200).json(await service.list(req.auth!.userId, parseQuery(noteListQuerySchema, req.query)));
  });

  // Registered before "/:id" so "trash" is never parsed as a note id.
  router.get("/trash", async (req, res) => {
    res.status(200).json(await service.listTrash(req.auth!.userId, parseQuery(pageQuerySchema, req.query)));
  });

  router.get("/:id", async (req, res) => {
    const { id } = parseParams(noteIdParamSchema, req.params);
    res.status(200).json(await service.get(req.auth!.userId, id));
  });

  router.patch("/:id", async (req, res) => {
    const { id } = parseParams(noteIdParamSchema, req.params);
    const note = await service.update(req.auth!.userId, id, parseBody(updateNoteRequestSchema, req.body));
    res.status(200).json(note);
  });

  router.delete("/:id", async (req, res) => {
    const { id } = parseParams(noteIdParamSchema, req.params);
    await service.softDelete(req.auth!.userId, id);
    res.status(204).end();
  });

  router.post("/:id/restore", async (req, res) => {
    const { id } = parseParams(noteIdParamSchema, req.params);
    res.status(200).json(await service.restore(req.auth!.userId, id));
  });

  router.put("/:id/tags/:tagId", async (req, res) => {
    const { id, tagId } = parseParams(noteTagParamsSchema, req.params);
    await tags.attach(req.auth!.userId, id, tagId);
    res.status(204).end();
  });

  router.delete("/:id/tags/:tagId", async (req, res) => {
    const { id, tagId } = parseParams(noteTagParamsSchema, req.params);
    await tags.detach(req.auth!.userId, id, tagId);
    res.status(204).end();
  });

  router.post("/:id/shares", async (req, res) => {
    const { id } = parseParams(noteIdParamSchema, req.params);
    const link = await sharing.create(req.auth!.userId, id, parseBody(createShareLinkRequestSchema, req.body));
    res.status(201).json(link);
  });

  router.get("/:id/shares", async (req, res) => {
    const { id } = parseParams(noteIdParamSchema, req.params);
    res.status(200).json(await sharing.list(req.auth!.userId, id));
  });

  router.delete("/:id/shares/:shareId", async (req, res) => {
    const { id, shareId } = parseParams(noteShareParamsSchema, req.params);
    await sharing.revoke(req.auth!.userId, id, shareId);
    res.status(204).end();
  });

  router.get("/:id/versions", async (req, res) => {
    const { id } = parseParams(noteIdParamSchema, req.params);
    res.status(200).json(await versions.list(req.auth!.userId, id, parseQuery(pageQuerySchema, req.query)));
  });

  router.get("/:id/versions/:versionNumber", async (req, res) => {
    const { id, versionNumber } = parseParams(versionNumberParamSchema, req.params);
    res.status(200).json(await versions.get(req.auth!.userId, id, versionNumber));
  });

  router.post("/:id/versions/:versionNumber/restore", async (req, res) => {
    const { id, versionNumber } = parseParams(versionNumberParamSchema, req.params);
    res.status(200).json(await versions.restore(req.auth!.userId, id, versionNumber));
  });

  return router;
}
