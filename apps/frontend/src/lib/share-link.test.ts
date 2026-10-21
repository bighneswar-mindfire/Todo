import { describe, expect, it } from "vitest";
import { makeShareLink } from "@/test/fixtures";
import { linkStatus, shareUrl } from "./share-link";

const NOW = Date.parse("2026-10-22T12:00:00.000Z");

describe("linkStatus", () => {
  it("Unit: no expiry and not revoked is active", () => {
    expect(linkStatus(makeShareLink(), NOW)).toBe("active");
  });

  it("Unit: a future expiry is active", () => {
    expect(linkStatus(makeShareLink({ expiresAt: "2026-10-22T12:00:01.000Z" }), NOW)).toBe("active");
  });

  it("Unit: a past expiry is expired", () => {
    expect(linkStatus(makeShareLink({ expiresAt: "2026-10-22T11:00:00.000Z" }), NOW)).toBe("expired");
  });

  it("Unit: expiry exactly now is expired", () => {
    expect(linkStatus(makeShareLink({ expiresAt: "2026-10-22T12:00:00.000Z" }), NOW)).toBe("expired");
  });

  it("Unit: revoked wins over expired and active", () => {
    const revokedAt = "2026-10-21T00:00:00.000Z";
    expect(linkStatus(makeShareLink({ revokedAt, expiresAt: "2026-10-22T11:00:00.000Z" }), NOW)).toBe("revoked");
    expect(linkStatus(makeShareLink({ revokedAt }), NOW)).toBe("revoked");
  });
});

describe("shareUrl", () => {
  it("Unit: joins origin, /shared/ and the token", () => {
    expect(shareUrl("abc", "https://notes.example")).toBe("https://notes.example/shared/abc");
  });

  it("Unit: defaults to the current origin", () => {
    expect(shareUrl("abc")).toBe(`${window.location.origin}/shared/abc`);
  });
});
