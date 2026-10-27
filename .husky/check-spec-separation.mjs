// pre-commit guard: a commit may change specs or production code, never both.
// Keeps specs from being written together with, or bent to match, the code.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const TEST_FILE = /\.test\.tsx?$/;

export const isCode = (file) =>
  !TEST_FILE.test(file) &&
  (/^(apps|packages)\/[^/]+\/src\//.test(file) || file.startsWith("apps/backend/prisma/"));

export const isSpec = (file) =>
  !file.startsWith("openspec/changes/archive/") &&
  (file.startsWith("openspec/specs/") ||
    /^openspec\/changes\/[^/]+\/(specs\/|delta-openapi\.yaml$)/.test(file));

export function violation(files) {
  const code = files.filter(isCode);
  const specs = files.filter(isSpec);
  return code.length > 0 && specs.length > 0 ? { code, specs } : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMRD"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const found = violation(staged);
  if (found) {
    const list = (files) => files.map((file) => `  ${file}`).join("\n");
    console.error(
      [
        "Spec and code are staged in the same commit. Commit them separately:",
        "spec changes first (reviewed at Gate 1), code after.",
        "",
        "Specs:",
        list(found.specs),
        "Code:",
        list(found.code),
      ].join("\n"),
    );
    process.exit(1);
  }
}
