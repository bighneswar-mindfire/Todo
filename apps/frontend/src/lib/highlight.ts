export interface HighlightPart {
  text: string;
  marked: boolean;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** One pass over the five entities the server emits, so `&amp;lt;` becomes `&lt;` and never `<`. */
function unescapeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

/**
 * Splits a server highlight string on `<mark>` / `</mark>` into text parts. Entities are decoded after the
 * split, so decoded text can never become a mark, and any other `<` stays plain text.
 */
export function parseHighlight(source: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  let marked = false;
  for (const piece of source.split(/(<\/?mark>)/)) {
    if (piece === "<mark>") marked = true;
    else if (piece === "</mark>") marked = false;
    else if (piece !== "") parts.push({ text: unescapeEntities(piece), marked });
  }
  return parts;
}
