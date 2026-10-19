import type { RequestHandler } from "express";
import { AppError } from "../errors.js";
import { verifyAccessToken } from "./tokens.js";

// Scheme is case-insensitive; exactly one space and one non-empty token with no whitespace.
const BEARER = /^Bearer ([^\s]+)$/i;

export function createAuthenticate({ secret }: { secret: string }): RequestHandler {
  return async (req, _res, next) => {
    const match = BEARER.exec(req.headers.authorization ?? "");
    if (!match) throw new AppError("UNAUTHORIZED", 401, "Unauthorized");
    req.auth = await verifyAccessToken(match[1] as string, secret);
    next();
  };
}
