import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { apiProxy, apiProxyRewrite } from "./api-proxy";

describe("dev proxy", () => {
  it("Dev proxy strips the prefix", () => {
    expect(apiProxyRewrite("/api/health")).toBe("/health");
    expect(apiProxyRewrite("/api/auth/login?x=1")).toBe("/auth/login?x=1");
    expect(apiProxy["/api"].rewrite("/api/notes")).toBe("/notes");

    // vite.config.ts cannot be imported under jsdom (import.meta.url is not a file URL),
    // so assert it wires the same proxy object into both dev and preview.
    const viteConfig = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    expect(viteConfig).toContain("server: { proxy: apiProxy }");
    expect(viteConfig).toContain("preview: { proxy: apiProxy }");
  });
});
