import type { Highlight } from "@todo/shared";
import { excerpt } from "../notes/summary.js";

// Private-use characters delimit marks inside ts_headline output. SQL strips them from the source text
// first, so note text can never forge one. They are swapped for real markup only after escaping.
export const MARK_START = "";
export const MARK_STOP = "";
export const SENTINELS = `${MARK_START}${MARK_STOP}`;

export const SNIPPET_MAX_LENGTH = 300;
const SNIPPET_SOURCE_LENGTH = 200;
const MAX_FRAGMENTS = 2;
const FRAGMENT_JOIN = " ... ";
const MARK_OVERHEAD = "<mark></mark>".length;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

interface Segment {
  text: string;
  marked: boolean;
}

interface Span {
  start: number;
  end: number;
}

function toSegments(headline: string): Segment[] {
  const segments: Segment[] = [];
  let marked = false;
  for (const part of headline.split(new RegExp(`([${MARK_START}${MARK_STOP}])`))) {
    if (part === MARK_START) marked = true;
    else if (part === MARK_STOP) marked = false;
    else if (part !== "") segments.push({ text: part, marked });
  }
  return segments;
}

function render(segments: Segment[]): string {
  return segments.map((s) => (s.marked ? `<mark>${escapeHtml(s.text)}</mark>` : escapeHtml(s.text))).join("");
}

function renderedLength(segments: Segment[]): number {
  return segments.reduce((n, s) => n + escapeHtml(s.text).length + (s.marked ? MARK_OVERHEAD : 0), 0);
}

// Cut whole words off the end (raw text, before escaping) until the rendered HTML fits.
function trimToFit(segments: Segment[], max: number): Segment[] {
  const out = segments.map((s) => ({ ...s }));
  while (out.length > 0 && renderedLength(out) > max) {
    const last = out[out.length - 1]!;
    const shorter = last.text.replace(/\s*\S+\s*$/, "");
    if (shorter === "" || shorter === last.text) out.pop();
    else last.text = shorter;
  }
  return out;
}

function markedSpans(segments: Segment[]): Span[] {
  const spans: Span[] = [];
  let pos = 0;
  for (const s of segments) {
    if (s.marked) spans.push({ start: pos, end: pos + s.text.length });
    pos += s.text.length;
  }
  return spans;
}

// A window of about `size` source characters around a match, snapped to word boundaries.
function windowAround(plain: string, match: Span, size: number): Span {
  const lead = Math.floor((size - (match.end - match.start)) / 3);
  let start = Math.max(0, match.start - Math.max(0, lead));
  let end = Math.min(plain.length, start + size);
  if (start > 0) {
    const gap = plain.slice(start, match.start).search(/\s/);
    if (gap !== -1) start += gap + 1;
  }
  if (end < plain.length) {
    const cut = plain.slice(match.end, end).search(/\s\S*$/);
    if (cut !== -1) end = match.end + cut;
  }
  return { start, end: Math.max(end, match.end) };
}

function clip(segments: Segment[], window: Span): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const s of segments) {
    const from = Math.max(pos, window.start);
    const to = Math.min(pos + s.text.length, window.end);
    if (from < to) out.push({ text: s.text.slice(from - pos, to - pos), marked: s.marked });
    pos += s.text.length;
  }
  return out;
}

function buildSnippet(contentHl: string, contentText: string): string {
  const segments = toSegments(contentHl);
  const spans = markedSpans(segments);
  const lead = (): string => render(trimToFit([{ text: excerpt(contentText), marked: false }], SNIPPET_MAX_LENGTH));
  const first = spans[0];
  if (!first) return lead();

  const plain = segments.map((s) => s.text).join("");
  const size = Math.floor(SNIPPET_SOURCE_LENGTH / MAX_FRAGMENTS);
  const one = windowAround(plain, first, SNIPPET_SOURCE_LENGTH);
  const firstWindow = windowAround(plain, first, size);
  const next = spans.find((s) => s.start >= firstWindow.end);
  const windows = next && plain.length > SNIPPET_SOURCE_LENGTH ? [firstWindow, windowAround(plain, next, size)] : [one];

  const fragments = windows.map((w) => clip(segments, w));
  while (fragments.length > 1 && fragments.reduce((n, f) => n + renderedLength(f), 0) + FRAGMENT_JOIN.length > SNIPPET_MAX_LENGTH) {
    fragments.pop();
  }
  if (fragments.length === 1) fragments[0] = trimToFit(fragments[0]!, SNIPPET_MAX_LENGTH);
  return fragments.map(render).join(FRAGMENT_JOIN);
}

/** Both inputs are `ts_headline(..., HighlightAll=true)` output delimited by the mark sentinels. */
export function buildHighlight(titleHl: string, contentHl: string, contentText: string): Highlight {
  return { title: render(toSegments(titleHl)), snippet: buildSnippet(contentHl, contentText) };
}
