import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { createQueryClient } from "./query-client";

describe("query client retry policy", () => {
  const retry = createQueryClient().getDefaultOptions().queries?.retry as (count: number, error: unknown) => boolean;

  it("does not retry requests the server rejected", () => {
    expect(retry(0, new ApiError(404, "NOT_FOUND", "gone"))).toBe(false);
  });

  it("retries network failures and server errors up to twice", () => {
    const network = new ApiError(undefined, "NETWORK_ERROR", "offline");
    const server = new ApiError(503, "INTERNAL_ERROR", "down");
    expect(retry(0, network)).toBe(true);
    expect(retry(1, server)).toBe(true);
    expect(retry(2, server)).toBe(false);
  });

  it("never retries mutations", () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});
