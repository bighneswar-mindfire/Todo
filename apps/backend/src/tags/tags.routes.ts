import { Router, type RequestHandler } from "express";
import { createTagRequestSchema, tagIdParamSchema, updateTagRequestSchema } from "@todo/shared";
import { parseBody, parseParams } from "../http/parse.js";
import type { TagsService } from "./tags.service.js";

export function createTagsRouter(service: TagsService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  router.post("/", async (req, res) => {
    const tag = await service.create(req.auth!.userId, parseBody(createTagRequestSchema, req.body));
    res.status(201).json(tag);
  });

  router.get("/", async (req, res) => {
    res.status(200).json(await service.list(req.auth!.userId));
  });

  router.patch("/:id", async (req, res) => {
    const { id } = parseParams(tagIdParamSchema, req.params);
    const tag = await service.update(req.auth!.userId, id, parseBody(updateTagRequestSchema, req.body));
    res.status(200).json(tag);
  });

  router.delete("/:id", async (req, res) => {
    const { id } = parseParams(tagIdParamSchema, req.params);
    await service.remove(req.auth!.userId, id);
    res.status(204).end();
  });

  return router;
}
