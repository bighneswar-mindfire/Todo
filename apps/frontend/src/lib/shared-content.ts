import type { TipTapDoc } from "@todo/shared";

type Block = NonNullable<TipTapDoc["content"]>[number];

/**
 * Drops marks the viewer's schema does not have (a `link` mark, for example). Without this the
 * editor would reject the whole document; with it the text is shown and simply is not a link.
 * Unknown node types are left alone on purpose: they must surface as a content error.
 */
export function stripUnsupportedMarks(doc: TipTapDoc, allowed: ReadonlySet<string>): TipTapDoc {
  return { ...doc, ...(doc.content ? { content: doc.content.map((block) => stripBlock(block, allowed)) } : {}) };
}

function stripBlock(node: Block, allowed: ReadonlySet<string>): Block {
  const next: Block = { ...node };
  if (Array.isArray(node["marks"])) {
    next["marks"] = (node["marks"] as { type?: unknown }[]).filter(
      (mark) => typeof mark.type === "string" && allowed.has(mark.type),
    );
  }
  if (Array.isArray(node["content"])) {
    next["content"] = (node["content"] as Block[]).map((child) => stripBlock(child, allowed));
  }
  return next;
}
