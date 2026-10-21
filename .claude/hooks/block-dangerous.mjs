// PreToolUse(Bash): exit 2 blocks the call and tells Claude why.
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  const command = JSON.parse(raw || "{}").tool_input?.command ?? "";
  const rules = [
    [/git\s+push\b[^\n]*(--force|\s-f\b)/, "force-push is not allowed"],
    [/git\s+push\b[^\n]*\bmain\b/, "never push directly to main"],
    [/git\s+reset\s+--hard/, "git reset --hard discards work; ask the user"],
    [/rm\s+-[a-z]*r[a-z]*f|rm\s+-[a-z]*f[a-z]*r|Remove-Item[^\n]*-Recurse/i, "recursive delete is blocked"],
    [/--dangerously-skip-permissions|--no-verify/, "do not bypass permissions or hooks"],
    [/(cat|type|Get-Content|less|more)\s+[^\n|]*\.env\b(?!\.example)/, "do not read .env files"],
    [/migrate\s+reset|DROP\s+(DATABASE|TABLE)/i, "destructive database command blocked"],
  ];
  for (const [re, why] of rules) {
    if (re.test(command)) {
      console.error(`Blocked: ${why}.`);
      process.exit(2);
    }
  }
});
