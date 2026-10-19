import request from "supertest";
import { describe, expect, it } from "vitest";
import { healthSchema } from "@todo/shared";
import { createApp } from "./app.js";

describe("health endpoint", () => {
  it("Healthy: returns 200 {status: ok} when the database is reachable", async () => {
    const app = createApp({ ping: async () => undefined });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("Database down: returns 503 {status: error} when the database is unreachable", async () => {
    const app = createApp({
      ping: async () => {
        throw new Error("connection refused");
      },
    });
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error" });
  });

  it("Shared export is consumed: response validates against the shared schema", async () => {
    const app = createApp({ ping: async () => undefined });
    const res = await request(app).get("/health");
    expect(healthSchema.parse(res.body)).toEqual({ status: "ok" });
  });
});
