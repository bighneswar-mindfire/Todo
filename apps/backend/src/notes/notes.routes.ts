import { Router, type RequestHandler } from "express";
import {
  createNoteRequestSchema,
  noteIdParamSchema,
  pageQuerySchema,
  updateNoteRequestSchema,
} from "@todo/shared";
import { parseBody, parseParams, parseQuery } from "../http/parse.js";
import type { NotesService } from "./notes.service.js";

export function createNotesRouter(service: NotesService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  router.post("/", async (req, res) => {
    const note = await service.create(req.auth!.userId, parseBody(createNoteRequestSchema, req.body));
    res.status(201).json(note);
  });

  router.get("/", async (req, res) => {
    res.status(200).json(await service.list(req.auth!.userId, parseQuery(pageQuerySchema, req.query)));
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

  return router;
}
