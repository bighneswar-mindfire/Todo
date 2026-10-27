// PreCompact: refresh the auto snapshot in session-context.md (branch, git state, active change,
// last handoff block, last review.md section, next tasks). The notes section, written by
// /save-context, is kept. Never blocks compaction.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const AUTO = /<!-- auto:start -->[\s\S]*?<!-- auto:end -->/;
const TEMPLATE = `# Session context

Local file (git-ignored). Read it at the start of a session to resume. The auto snapshot is rewritten before every compaction; the notes are written by /save-context and kept.

<!-- auto:start -->
<!-- auto:end -->

<!-- notes:start -->
(none yet: run /save-context)
<!-- notes:end -->
`;

// "feature/backend/AB-1042-user-registration" -> "ab-1042"
export function ticketOf(branch) {
  return /AB-(\d+)/i.exec(branch)?.[1] ? `ab-${/AB-(\d+)/i.exec(branch)[1]}` : null;
}

export function pickChange(changes, branch) {
  const ticket = ticketOf(branch);
  const byTicket = ticket ? changes.filter((c) => c === ticket || c.startsWith(`${ticket}-`)) : [];
  if (byTicket.length === 1) return byTicket[0];
  return changes.length === 1 && byTicket.length === 0 ? changes[0] : null;
}

export function lastBlock(text, marker) {
  const lines = text.split("\n");
  let start = -1;
  lines.forEach((line, i) => {
    if (line.startsWith(marker)) start = i;
  });
  return start === -1 ? null : lines.slice(start).join("\n").trim();
}

export function taskProgress(tasksText) {
  const done = (tasksText.match(/^- \[[xX]\] /gm) ?? []).length;
  const pending = tasksText.split("\n").filter((line) => /^- \[ \] /.test(line));
  return { done, total: done + pending.length, next: pending.slice(0, 3) };
}

export function buildSnapshot({ now, trigger, sessionId, branch, head, status, change, handoff, review, tasks }) {
  const files = status.filter(Boolean);
  const out = [
    "## Auto snapshot",
    `- Saved: ${now} (compaction: ${trigger}, session ${sessionId})`,
    `- Branch: ${branch || "unknown"} @ ${head || "unknown"}`,
    files.length === 0
      ? "- Working tree: clean"
      : `- Working tree: ${files.length} changed path(s)\n${files
          .slice(0, 20)
          .map((f) => `  - ${f}`)
          .join("\n")}${files.length > 20 ? `\n  - ... ${files.length - 20} more` : ""}`,
  ];
  if (!change) {
    out.push("- Active change: none found for this branch");
  } else {
    out.push(`- Active change: ${change} (openspec/changes/${change}/)`);
    if (tasks) {
      out.push(`- Tasks: ${tasks.done}/${tasks.total} done`);
      for (const task of tasks.next) out.push(`  - next: ${task.replace(/^- \[ \] /, "")}`);
    }
    out.push(`- Last handoff block:\n\n${handoff ? indent(handoff) : "  (none)"}`);
    out.push(`- Last review.md section: ${review ?? "(none)"}`);
  }
  return out.join("\n");
}

const indent = (text) =>
  text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");

export function applySnapshot(existing, snapshot) {
  const base = existing && AUTO.test(existing) ? existing : TEMPLATE;
  return base.replace(AUTO, () => `<!-- auto:start -->\n${snapshot}\n<!-- auto:end -->`);
}

function git(root, args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function collect(root, input) {
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const changesDir = join(root, "openspec", "changes");
  const changes = existsSync(changesDir)
    ? readdirSync(changesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== "archive")
        .map((d) => d.name)
    : [];
  const change = pickChange(changes, branch);
  const dir = change ? join(changesDir, change) : null;
  const tasksText = dir ? read(join(dir, "tasks.md")) : null;
  const handoffText = dir ? read(join(dir, "handoff.md")) : null;
  const reviewText = dir ? read(join(dir, "review.md")) : null;
  return {
    now: new Date().toISOString(),
    trigger: input.trigger ?? "unknown",
    sessionId: String(input.session_id ?? "unknown").slice(0, 8),
    branch,
    head: git(root, ["rev-parse", "--short", "HEAD"]),
    status: git(root, ["status", "--short"]).split("\n"),
    change,
    handoff: handoffText ? lastBlock(handoffText, "### ") : null,
    review: reviewText ? lastBlock(reviewText, "## ")?.split("\n")[0] : null,
    tasks: tasksText ? taskProgress(tasksText) : null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    try {
      const input = JSON.parse(raw || "{}");
      const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]) || process.cwd();
      const file = join(root, "session-context.md");
      writeFileSync(file, applySnapshot(read(file), buildSnapshot(collect(root, input))));
    } catch {
      // never block compaction
    }
  });
}
