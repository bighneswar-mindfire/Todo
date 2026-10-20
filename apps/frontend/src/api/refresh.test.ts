import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { login } from "./auth";
import { request } from "./client";
import { useSession } from "@/stores/session";
import { callsTo, errorResponse, json, route } from "@/test/fake-api";
import { makeSession, signIn } from "@/test/fixtures";

const NEW_TOKENS = { accessToken: "access-2", refreshToken: "refresh-2" };

/** /notes answers 401 for the old token and 200 for the refreshed one. */
function routeNotes(): void {
  route("GET /notes", (req) =>
    req.headers.get("Authorization") === `Bearer ${NEW_TOKENS.accessToken}`
      ? json(200, { ok: true })
      : errorResponse(401, "UNAUTHORIZED", "expired"),
  );
}

describe("silent token refresh", () => {
  it("Expired access token refreshed transparently", async () => {
    signIn();
    routeNotes();
    route("POST /auth/refresh", () => json(200, NEW_TOKENS));

    const result = await request<{ ok: boolean }>("/notes", { auth: "bearer" });

    expect(result).toEqual({ ok: true });
    expect(useSession.getState().session).toMatchObject(NEW_TOKENS);
    expect(callsTo("POST /auth/refresh")[0]?.body).toEqual({ refreshToken: "refresh-1" });
    expect(callsTo("GET /notes")).toHaveLength(2);
  });

  it("Concurrent 401s refresh once", async () => {
    signIn();
    routeNotes();
    route("POST /auth/refresh", async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return json(200, NEW_TOKENS);
    });

    const results = await Promise.all([
      request("/notes", { auth: "bearer" }),
      request("/notes", { auth: "bearer" }),
      request("/notes", { auth: "bearer" }),
    ]);

    expect(results).toHaveLength(3);
    expect(callsTo("POST /auth/refresh")).toHaveLength(1);
    const successes = callsTo("GET /notes").filter((c) => c.headers.get("Authorization") === "Bearer access-2");
    expect(successes).toHaveLength(3);
  });

  it("Failed refresh signs the user out", async () => {
    signIn();
    routeNotes();
    route("POST /auth/refresh", () => errorResponse(401, "INVALID_REFRESH_TOKEN", "bad"));

    const error = (await request("/notes", { auth: "bearer" }).catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe("INVALID_REFRESH_TOKEN");
    expect(useSession.getState().session).toBeNull();
  });

  it("Retry is not repeated", async () => {
    signIn();
    route("GET /notes", () => errorResponse(401, "UNAUTHORIZED", "still no"));
    route("POST /auth/refresh", () => json(200, NEW_TOKENS));

    const error = (await request("/notes", { auth: "bearer" }).catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(401);
    expect(callsTo("POST /auth/refresh")).toHaveLength(1);
    expect(callsTo("GET /notes")).toHaveLength(2);
    expect(useSession.getState().session).toBeNull();
  });

  it("Public endpoints never trigger refresh", async () => {
    useSession.getState().setSession(makeSession());
    route("POST /auth/login", () => errorResponse(401, "INVALID_CREDENTIALS", "nope"));

    const error = (await login({ email: "a@b.co", password: "wrong" }).catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe("INVALID_CREDENTIALS");
    expect(callsTo("POST /auth/refresh")).toHaveLength(0);
    expect(useSession.getState().session).not.toBeNull();
  });
});
