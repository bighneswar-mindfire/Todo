import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const readJson = (path: string) => JSON.parse(read(path)) as Record<string, unknown>;

const workspacePackages = [
  "package.json",
  "apps/backend/package.json",
  "apps/frontend/package.json",
  "packages/shared/package.json",
  "packages/repo-checks/package.json",
];

function commitlint(message: string) {
  return spawnSync("pnpm", ["exec", "commitlint"], {
    cwd: root,
    input: message,
    encoding: "utf8",
    shell: true,
  });
}

describe("monorepo layout", () => {
  it("Workspace packages resolve: all three workspace packages exist and are linked", () => {
    expect(read("pnpm-workspace.yaml")).toContain("apps/*");
    expect(read("pnpm-workspace.yaml")).toContain("packages/*");
    for (const dir of ["apps/backend", "apps/frontend", "packages/shared"]) {
      expect(existsSync(join(root, dir, "package.json"))).toBe(true);
    }
    expect(existsSync(join(root, "apps/backend/node_modules/@todo/shared/package.json"))).toBe(true);
    expect(existsSync(join(root, "apps/frontend/node_modules/@todo/shared/package.json"))).toBe(true);
  });

  it("No floating versions: no dependency uses latest, ^ or ~", () => {
    for (const file of workspacePackages) {
      const pkg = readJson(file);
      for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
        const deps = (pkg[field] ?? {}) as Record<string, string>;
        for (const [name, version] of Object.entries(deps)) {
          expect(version, `${file} ${name}`).not.toMatch(/latest|\^|~/);
        }
      }
    }
  });

  it("Wrong runtime rejected: Node 22 and pnpm 10 are pinned with engine-strict", () => {
    const pkg = readJson("package.json");
    const engines = pkg["engines"] as Record<string, string>;
    expect(engines["node"]).toBe(">=22.12.0 <23");
    expect(engines["pnpm"]).toBe(">=10 <11");
    expect(pkg["packageManager"]).toMatch(/^pnpm@10\.\d+\.\d+$/);
    expect(read(".npmrc")).toContain("engine-strict=true");
    expect(read(".nvmrc").trim()).toBe("22");
  });
});

describe("quality gates", () => {
  it("Clean checkpoint: root defines build, lint and test scripts", () => {
    const scripts = readJson("package.json")["scripts"] as Record<string, string>;
    expect(scripts["build"]).toBeTruthy();
    expect(scripts["lint"]).toBeTruthy();
    expect(scripts["test"]).toBeTruthy();
  });

  it("Failing check blocks commit: pre-commit runs build and lint, commit-msg runs commitlint and tests (not for test commits)", () => {
    const commands = read(".husky/pre-commit")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"));
    expect(commands).toEqual([
      "node .husky/check-spec-separation.mjs && node .husky/check-review-log.mjs && pnpm build && pnpm lint --max-warnings 0",
    ]);
    const commitMsg = read(".husky/commit-msg");
    expect(commitMsg).toContain("commitlint");
    expect(commitMsg).toMatch(/test:\*\|test\\\(\*\|test!\*\)[^;]*;;\s*\n\s*\*\)\s*pnpm test/);
  });

  it("Bad commit message rejected: commitlint fails without a type and colon", () => {
    expect(commitlint("added stuff").status).not.toBe(0);
    expect(commitlint("added stuff AB#1001").status).not.toBe(0);
  });

  it("Good commit message accepted: type: description", () => {
    expect(commitlint("feat: add monorepo").status).toBe(0);
    expect(commitlint("feat(setup): add monorepo").status).toBe(0);
  });
});

describe("specs and code are committed separately", () => {
  type Violation = { code: string[]; specs: string[] } | null;
  const loadGuard = async () =>
    (await import(pathToFileURL(join(root, ".husky/check-spec-separation.mjs")).href)) as {
      violation: (files: string[]) => Violation;
    };

  it("Spec and code in one commit rejected", async () => {
    const { violation } = await loadGuard();
    expect(
      violation(["openspec/changes/ab-1/specs/notes/spec.md", "apps/backend/src/notes/notes.service.ts"]),
    ).toEqual({
      code: ["apps/backend/src/notes/notes.service.ts"],
      specs: ["openspec/changes/ab-1/specs/notes/spec.md"],
    });
    expect(violation(["openspec/specs/notes/spec.md", "apps/backend/prisma/schema.prisma"])).not.toBeNull();
    expect(violation(["openspec/changes/ab-1/delta-openapi.yaml", "packages/shared/src/index.ts"])).not.toBeNull();
  });

  it("Spec or tests committed without production code accepted", async () => {
    const { violation } = await loadGuard();
    expect(violation(["openspec/specs/notes/spec.md", "openspec/changes/ab-1/tasks.md"])).toBeNull();
    expect(violation(["openspec/specs/notes/spec.md", "apps/backend/src/notes/notes.test.ts"])).toBeNull();
    expect(violation(["apps/frontend/src/App.tsx", "apps/frontend/src/App.test.tsx"])).toBeNull();
    expect(
      violation(["openspec/changes/archive/2026-10-27-ab-1/specs/notes/spec.md", "apps/backend/src/a.ts"]),
    ).toBeNull();
  });
});

describe("change logs are append-only and checkpoints are recorded", () => {
  type Guard = {
    appendOnlyViolations: (numstat: string[]) => string[];
    missingCheckpointRecords: (tasks: string, review: string | null) => string[];
  };
  const loadGuard = async () =>
    (await import(pathToFileURL(join(root, ".husky/check-review-log.mjs")).href)) as Guard;

  const tasks = [
    "## 1. Shared",
    "- [x] 1.1 Test",
    "- [x] 1.2 Checkpoint: build, lint, test",
    "## 2. Backend",
    "- [x] 2.1 Test",
    "- [ ] 2.2 Checkpoint: build, lint, test",
  ].join("\n");
  const pass = "## 2026-10-27 | apply | group 1: Shared | PASS";
  const fail = "## 2026-10-27 | apply | group 1: Shared | FAIL";

  it("Edited review log line rejected", async () => {
    const { appendOnlyViolations } = await loadGuard();
    expect(appendOnlyViolations(["3\t1\topenspec/changes/ab-1/review.md"])).toHaveLength(1);
    expect(appendOnlyViolations(["2\t2\topenspec/changes/ab-1/handoff.md"])).toHaveLength(1);
    expect(appendOnlyViolations(["9\t0\topenspec/changes/ab-1/review.md"])).toEqual([]);
    expect(appendOnlyViolations(["4\t4\topenspec/changes/ab-1/tasks.md"])).toEqual([]);
  });

  it("Ticked checkpoint without a PASS record rejected", async () => {
    const { missingCheckpointRecords } = await loadGuard();
    expect(missingCheckpointRecords(tasks, null)).toHaveLength(1);
    expect(missingCheckpointRecords(tasks, "# Review log")).toHaveLength(1);
    expect(missingCheckpointRecords(tasks, `${pass}\n${fail}`)).toHaveLength(1);
  });

  it("Ticked checkpoint with a PASS record accepted", async () => {
    const { missingCheckpointRecords } = await loadGuard();
    expect(missingCheckpointRecords(tasks, pass)).toEqual([]);
    expect(missingCheckpointRecords(tasks, `${fail}\n${pass}`)).toEqual([]);
    expect(missingCheckpointRecords("## 1. Shared\n- [ ] 1.1 Checkpoint", null)).toEqual([]);
  });
});

describe("continuous integration", () => {
  const workflow = () => read(".github/workflows/ci.yml");

  it("CI runs on pull requests: the workflow triggers on pull_request and pushes to main", () => {
    expect(existsSync(join(root, ".github/workflows/ci.yml"))).toBe(true);
    expect(workflow()).toMatch(/^\s*pull_request:/m);
    expect(workflow()).toMatch(/^\s*push:\s*\n\s*branches:\s*\[main\]/m);
  });

  it("CI repeats the local gate: it runs build, lint, coverage tests and strict spec validation", () => {
    for (const command of [
      "pnpm install --frozen-lockfile",
      "pnpm build",
      "pnpm lint --max-warnings 0",
      "pnpm test --coverage",
      "pnpm exec openspec validate --changes --strict --no-interactive",
      "pnpm exec openspec validate --archived",
    ]) {
      expect(workflow(), command).toContain(command);
    }
  });

  it("CI checks commit messages: commitlint runs over every commit in the pull request", () => {
    expect(workflow()).toMatch(/commitlint --from\s+\S+\s+--to\s+\S+/);
  });

  it("CI does not float: actions are pinned to exact versions and secrets are not used", () => {
    const uses = [...workflow().matchAll(/uses:\s*(\S+)/g)].map((m) => m[1] ?? "");
    expect(uses.length).toBeGreaterThan(0);
    for (const ref of uses) {
      expect(ref, ref).toMatch(/@v\d+\.\d+\.\d+$/);
    }
    expect(workflow()).not.toMatch(/\$\{\{\s*secrets\./);
  });
});

describe("claude code configuration", () => {
  it("Reviewer is read-only: the agent grants Read, Grep, Glob and git diff/log only", () => {
    const agent = read(".claude/agents/reviewer.md");
    const tools = /^tools:\s*(.+)$/m.exec(agent)?.[1]?.split(/,\s*(?![^(]*\))/).map((t) => t.trim());
    expect(tools).toEqual(["Read", "Grep", "Glob", "Bash(git diff:*)", "Bash(git log:*)"]);
  });

  it("Context7 configured: .mcp.json defines a pinned Context7 server", () => {
    const mcp = readJson(".mcp.json") as { mcpServers: Record<string, { args: string[] }> };
    const args = mcp.mcpServers["context7"]?.args ?? [];
    expect(args.some((a) => /^@upstash\/context7-mcp@\d+\.\d+\.\d+$/.test(a))).toBe(true);
  });

  it("Workflow commands exist: /opsx:* and /create-pr", () => {
    for (const name of ["opsx/explore", "opsx/propose", "opsx/update", "opsx/apply", "opsx/sync", "opsx/archive", "create-pr"]) {
      expect(existsSync(join(root, ".claude/commands", `${name}.md`)), name).toBe(true);
    }
    for (const file of ["AGENTS.md", "docs/FRS.md", "docs/SDS.md", "CLAUDE.md", "apps/backend/CLAUDE.md", "apps/frontend/CLAUDE.md", "packages/shared/CLAUDE.md"]) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });
});
