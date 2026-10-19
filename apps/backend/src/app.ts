import express, { type Express } from "express";
import type { Health } from "@todo/shared";
import type { Ping } from "./db.js";

export interface AppDeps {
  ping: Ping;
}

export function createApp({ ping }: AppDeps): Express {
  const app = express();
  app.use(express.json());

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

  return app;
}
