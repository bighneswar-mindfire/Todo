import { describe, expect, it, vi } from "vitest";
import { SESSION_STORAGE_KEY, selectIsAuthenticated, useSession } from "./session";
import { makeSession } from "@/test/fixtures";

describe("session store", () => {
  it("Session set after login", () => {
    const session = makeSession();

    useSession.getState().setSession(session);

    expect(useSession.getState().session).toEqual(session);
    expect(selectIsAuthenticated(useSession.getState())).toBe(true);
  });

  it("Session restored after reload", async () => {
    const session = makeSession({ accessToken: "persisted-access" });
    useSession.getState().setSession(session);

    vi.resetModules();
    const reloaded = await import("./session");

    expect(reloaded.useSession.getState().session).toEqual(session);
    expect(reloaded.selectIsAuthenticated(reloaded.useSession.getState())).toBe(true);
  });

  it("Corrupt persisted session ignored", async () => {
    for (const bad of ["{not json", JSON.stringify({ state: { session: { accessToken: 1 } }, version: 1 })]) {
      localStorage.setItem(SESSION_STORAGE_KEY, bad);
      vi.resetModules();

      const reloaded = await import("./session");

      expect(reloaded.useSession.getState().session).toBeNull();
      expect(reloaded.selectIsAuthenticated(reloaded.useSession.getState())).toBe(false);
    }
  });

  it("keeps working in memory when localStorage is unavailable", async () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    vi.stubGlobal("localStorage", broken);
    vi.resetModules();
    const fresh = await import("./session");

    fresh.useSession.getState().setSession(makeSession());
    expect(fresh.useSession.getState().session).not.toBeNull();
    fresh.useSession.getState().clearSession();
    expect(fresh.useSession.getState().session).toBeNull();
  });

  it("follows a login or logout made in another tab", async () => {
    const session = makeSession({ accessToken: "from-other-tab" });
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state: { session }, version: 1 }));

    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_STORAGE_KEY }));
    await vi.waitFor(() => expect(useSession.getState().session).toEqual(session));

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state: { session: null }, version: 1 }));
    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_STORAGE_KEY }));
    await vi.waitFor(() => expect(useSession.getState().session).toBeNull());
  });

  it("ignores a token rotation when signed out", () => {
    useSession.getState().setTokens({ accessToken: "a", refreshToken: "b" });

    expect(useSession.getState().session).toBeNull();
  });

  it("Clear session", () => {
    useSession.getState().setSession(makeSession({ accessToken: "secret-access", refreshToken: "secret-refresh" }));

    useSession.getState().clearSession();

    expect(useSession.getState().session).toBeNull();
    const stored = localStorage.getItem(SESSION_STORAGE_KEY) ?? "";
    expect(stored).not.toContain("secret-access");
    expect(stored).not.toContain("secret-refresh");
  });
});
