import { Router, type RequestHandler } from "express";
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
} from "@todo/shared";
import { parseBody } from "../http/parse.js";
import type { AuthService } from "./auth.service.js";

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

  router.post("/forgot-password", async (req, res) => {
    const { email } = parseBody(forgotPasswordRequestSchema, req.body);
    res.status(202).json(await service.forgotPassword(email));
  });

  router.post("/reset-password", async (req, res) => {
    await service.resetPassword(parseBody(resetPasswordRequestSchema, req.body));
    res.status(204).end();
  });

  router.post("/logout", authenticate, async (req, res) => {
    const { refreshToken } = parseBody(logoutRequestSchema, req.body);
    await service.logout(req.auth!.userId, refreshToken);
    res.status(204).end();
  });

  return router;
}
