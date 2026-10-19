import express, { type Express } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../errors.js";
import { errorHandler } from "./error-handler.js";

const SECRET = "s3cr3t-distinctive-value-9f2b";

function buildApp(): Express {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/echo", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/app-error", () => {
    throw new AppError("UNAUTHORIZED", 401, "Nope", [
      { field: "x", message: "bad" },
    ]);
  });
  app.get("/boom", () => {
    throw new Error(`kaboom ${SECRET}`);
  });
  app.use(errorHandler);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("error handler", () => {
  it("[design] Malformed JSON: returns 400 VALIDATION_ERROR without echoing or logging the body", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await request(buildApp())
      .post("/echo")
      .set("Content-Type", "application/json")
      .send(`{"password": "${SECRET}", oops`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { field: "body", message: "Malformed or unsupported request body" },
    ]);
    expect(res.text).not.toContain(SECRET);
    expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET);
  });

  it("[design] Oversized body: returns 400 VALIDATION_ERROR", async () => {
    const res = await request(buildApp())
      .post("/echo")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ blob: "a".repeat(5000) }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("[design] Unexpected error: returns 500 INTERNAL_ERROR with no stack trace or message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await request(buildApp()).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.text).not.toContain("kaboom");
    expect(res.text).not.toContain(SECRET);
    expect(res.text).not.toMatch(/\bat .*\(/);
    expect(res.text).not.toContain("stack");
    expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET);
  });

  it("[design] Unsupported charset: returns 400 VALIDATION_ERROR", async () => {
    const res = await request(buildApp())
      .post("/echo")
      .set("Content-Type", "application/json; charset=bogus")
      .send(JSON.stringify({ a: 1 }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("[design] Unsupported content encoding: returns 400 VALIDATION_ERROR", async () => {
    const res = await request(buildApp())
      .post("/echo")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "bogus")
      .send(JSON.stringify({ a: 1 }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("[design] Thrown non-Error value: returns 500 INTERNAL_ERROR without echoing it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = express();
    app.get("/throw-string", () => {
      throw SECRET;
    });
    app.use(errorHandler);
    const res = await request(app).get("/throw-string");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.text).not.toContain(SECRET);
    expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET);
  });

  it("[design] AppError: maps to its status, code, message and details", async () => {
    const res = await request(buildApp()).get("/app-error");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Nope",
        details: [{ field: "x", message: "bad" }],
      },
    });
  });
});
