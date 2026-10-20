import express, { type Express } from "express";
import type { Health } from "@todo/shared";
import { createAuthRouter } from "./auth/auth.routes.js";
import { createAuthenticate } from "./auth/authenticate.js";
import { createAuthService } from "./auth/auth.service.js";
import type { OtpSender } from "./auth/otp.js";
import type { PasswordHasher } from "./auth/password.js";
import type { Ping } from "./db.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createNotesRouter } from "./notes/notes.routes.js";
import { createNotesService } from "./notes/notes.service.js";
import { createTagsRouter } from "./tags/tags.routes.js";
import { createTagsService } from "./tags/tags.service.js";

export interface AppDeps {
  ping: Ping;
  prisma: PrismaClient;
  hasher: PasswordHasher;
  jwt: { secret: string };
  otpSender?: OtpSender;
}

export function createApp({ ping, prisma, hasher, jwt, otpSender }: AppDeps): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", async (_req, res) => {
    try {
      await ping();
      const body: Health = { status: "ok" };
      res.status(200).json(body);
    } catch (err) {
      console.error("health check failed:", String(err));
      const body: Health = { status: "error" };
      res.status(503).json(body);
    }
  });

  app.use(
    "/auth",
    createAuthRouter(createAuthService({ prisma, hasher, jwt, ...(otpSender ? { otpSender } : {}) }), createAuthenticate(jwt)),
  );

  const tagsService = createTagsService({ prisma });
  app.use("/tags", createTagsRouter(tagsService, createAuthenticate(jwt)));
  app.use("/notes", createNotesRouter(createNotesService({ prisma }), tagsService, createAuthenticate(jwt)));

  app.use(errorHandler);

  return app;
}
