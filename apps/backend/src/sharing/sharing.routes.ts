import { Router } from "express";
import { sharedTokenParamSchema } from "@todo/shared";
import { parseParams } from "../http/parse.js";
import type { SharingService } from "./sharing.service.js";

/** Public, unauthenticated. Mounted at /shared. */
export function createSharedRouter(service: SharingService): Router {
  const router = Router();

  router.get("/:token", async (req, res) => {
    const { token } = parseParams(sharedTokenParamSchema, req.params);
    const note = await service.getShared(token);
    // no-store so every open reaches the server and is counted; no-referrer so the token does not leak.
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    res.status(200).json(note);
  });

  return router;
}
