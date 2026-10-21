import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { useSession } from "@/stores/session";
import { installFakeApi, resetFakeApi } from "@/test/fake-api";

// ProseMirror measures layout, which jsdom does not implement.
const emptyRect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
Range.prototype.getBoundingClientRect = () => emptyRect as DOMRect;
Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
document.elementFromPoint = () => null;
Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  resetFakeApi();
  installFakeApi();
  localStorage.clear();
  useSession.setState({ session: null });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
