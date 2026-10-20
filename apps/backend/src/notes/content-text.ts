const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "horizontalRule",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "hardBreak",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function walk(node: unknown, out: string[]): void {
  if (!isRecord(node)) return;
  if (node.type === "text") {
    if (typeof node.text === "string") out.push(node.text);
    return;
  }
  const isBlock = typeof node.type === "string" && BLOCK_TYPES.has(node.type);
  if (isBlock) out.push(" ");
  if (Array.isArray(node.content)) {
    for (const child of node.content) walk(child, out);
  }
  if (isBlock) out.push(" ");
}

/** Plain text of a TipTap document; blocks are separated by a space. Never throws. */
export function extractText(doc: unknown): string {
  const out: string[] = [];
  walk(doc, out);
  return out.join("").replace(/\s+/g, " ").trim();
}
