import { Router, type RequestHandler } from "express";
import { searchQuerySchema } from "@todo/shared";
import { parseQuery } from "../http/parse.js";
import type { SearchService } from "./search.service.js";

export function createSearchRouter(service: SearchService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", async (req, res) => {
    res.status(200).json(await service.search(req.auth!.userId, parseQuery(searchQuerySchema, req.query)));
  });

  return router;
}
