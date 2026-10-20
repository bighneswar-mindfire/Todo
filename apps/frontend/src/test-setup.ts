import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { useSession } from "@/stores/session";
import { installFakeApi, resetFakeApi } from "@/test/fake-api";

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
