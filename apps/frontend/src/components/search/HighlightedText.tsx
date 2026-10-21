import { Fragment } from "react";
import { parseHighlight } from "@/lib/highlight";

/** Renders a server highlight string as text and `<mark>` elements. It never inserts the string as HTML. */
export function HighlightedText({ value }: { value: string }) {
  return (
    <>
      {parseHighlight(value).map((part, index) =>
        part.marked ? <mark key={index}>{part.text}</mark> : <Fragment key={index}>{part.text}</Fragment>,
      )}
    </>
  );
}
