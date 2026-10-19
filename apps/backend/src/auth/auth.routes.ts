import { Router, type RequestHandler } from "express";
import {
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  zodIssuesToDetails,
  type ErrorDetail,
} from "@todo/shared";
import { AppError } from "../errors.js";
import type { AuthService } from "./auth.service.js";

interface BodySchema<T> {
  safeParse(
    data: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: Parameters<typeof zodIssuesToDetails>[0] } };
}

function parseBody<T>(schema: BodySchema<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const details: ErrorDetail[] = zodIssuesToDetails(result.error.issues);
    throw new AppError("VALIDATION_ERROR", 400, "Validation failed", details);
  }
  return result.data;
}

export function createAuthRouter(service: AuthService, authenticate: RequestHandler): Router {
  const router = Router();

  router.post("/register", async (req, res) => {
    const user = await service.register(parseBody(registerRequestSchema, req.body));
    res.status(201).json({ user });
  });

  router.post("/login", async (req, res) => {
    const tokens = await service.login(parseBody(loginRequestSchema, req.body));
    res.status(200).json(tokens);
  });

  router.post("/refresh", async (req, res) => {
    const { refreshToken } = parseBody(refreshRequestSchema, req.body);
    const tokens = await service.refresh(refreshToken);
    res.status(200).json(tokens);
  });

  router.post("/logout", authenticate, async (req, res) => {
    const { refreshToken } = parseBody(logoutRequestSchema, req.body);
    await service.logout(req.auth!.userId, refreshToken);
    res.status(204).end();
  });

  return router;
}
