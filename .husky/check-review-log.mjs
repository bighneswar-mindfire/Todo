// pre-commit guard for the per-change logs (see .claude/rules/checkpoint.md and handoff.md):
// 1. review.md and handoff.md are append-only: a staged edit may not remove or change a line.
// 2. A task group whose checkpoint task is ticked in tasks.md needs a PASS section in review.md.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CHANGE_FILE = /^openspec\/changes\/(?!archive\/)([^/]+)\/(review|handoff|tasks)\.md$/;
const APPEND_ONLY = /^openspec\/changes\/(?!archive\/)[^/]+\/(review|handoff)\.md$/;
const SECTION = /^## \d{4}-\d{2}-\d{2} \| apply \| group (\d+)\b.*\| (PASS|FAIL)\s*$/;

// numstat lines: "<added>\t<deleted>\t<path>"
export function appendOnlyViolations(numstatLines) {
  return numstatLines
    .map((line) => line.split("\t"))
    .filter(([, deleted, path]) => APPEND_ONLY.test(path ?? "") && Number(deleted) > 0)
    .map(([, deleted, path]) => `${path}: ${deleted} existing line(s) changed or removed`);
}

// Groups whose checkpoint task is ticked: "## 2. Title" then "- [x] 2.5 Checkpoint: ..."
export function tickedCheckpointGroups(tasksText) {
  const groups = new Set();
  let group = null;
  for (const line of tasksText.split("\n")) {
    const heading = /^## (\d+)\./.exec(line);
    if (heading) group = heading[1];
    if (group && /^- \[[xX]\] \d+\.\d+\b.*checkpoint/i.test(line)) groups.add(group);
  }
  return [...groups];
}

// The latest section of each group must be PASS.
export function missingCheckpointRecords(tasksText, reviewText) {
  const latest = new Map();
  for (const line of (reviewText ?? "").split("\n")) {
    const match = SECTION.exec(line);
    if (match) latest.set(match[1], match[2]);
  }
  return tickedCheckpointGroups(tasksText)
    .filter((group) => latest.get(group) !== "PASS")
    .map((group) =>
      latest.has(group)
        ? `group ${group}: latest review.md section is FAIL`
        : `group ${group}: no "apply | group ${group}" section in review.md`,
    );
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function indexFile(path) {
  try {
    return git(["show", `:${path}`]);
  } catch {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = [];
  const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]).split("\n").filter(Boolean);

  const numstat = git(["diff", "--cached", "--numstat", "--diff-filter=M"]).split("\n").filter(Boolean);
  problems.push(...appendOnlyViolations(numstat));

  const changes = new Set(staged.map((file) => CHANGE_FILE.exec(file)?.[1]).filter(Boolean));
  for (const change of changes) {
    const dir = `openspec/changes/${change}`;
    const tasks = indexFile(`${dir}/tasks.md`);
    if (tasks === null) continue;
    const review = indexFile(`${dir}/review.md`);
    for (const missing of missingCheckpointRecords(tasks, review)) problems.push(`${dir}: ${missing}`);
  }

  if (problems.length > 0) {
    console.error(
      ["Change logs are not in order (.claude/rules/checkpoint.md):", ...problems.map((p) => `  ${p}`)].join("\n"),
    );
    process.exit(1);
  }
}
