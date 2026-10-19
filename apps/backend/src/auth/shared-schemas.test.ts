import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : sourceFiles(path);
    return /\.ts$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".d.ts") ? [path] : [];
  });
}

function assertNoLocalZod(): void {
  for (const file of sourceFiles(srcDir)) {
    const text = readFileSync(file, "utf8");
    expect(text, file).not.toMatch(/from\s+["']zod["']/);
    expect(text, file).not.toMatch(/\bz\.object\(/);
  }
}

describe("auth: configuration and shared schemas", () => {
  it("Backend consumes shared auth schemas", () => {
    const routes = readFileSync(join(srcDir, "auth", "auth.routes.ts"), "utf8");
    const sharedImport = /import\s*\{([^}]*)\}\s*from\s*"@todo\/shared"/.exec(routes);
    expect(sharedImport).not.toBeNull();
    for (const schema of [
      "registerRequestSchema",
      "loginRequestSchema",
      "refreshRequestSchema",
      "logoutRequestSchema",
    ]) {
      expect(sharedImport?.[1]).toContain(schema);
    }

    assertNoLocalZod();
  });
});
