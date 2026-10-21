// PostToolUse(Edit|Write): run eslint --fix on the changed TS/JS file. Never blocks.
import { spawnSync } from "node:child_process";

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  const file = JSON.parse(raw || "{}").tool_input?.file_path ?? "";
  if (!/\.(ts|tsx|js|mjs)$/.test(file) || /node_modules|generated|[\\/]dist[\\/]/.test(file)) return;
  spawnSync("pnpm", ["exec", "eslint", "--fix", file], { stdio: "ignore", shell: true });
});
