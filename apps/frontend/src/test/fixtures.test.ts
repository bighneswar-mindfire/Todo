import {
  noteVersionListResponseSchema,
  noteVersionSchema,
  noteVersionSummarySchema,
  shareLinkListResponseSchema,
  shareLinkSchema,
  sharedNoteSchema,
} from "@todo/shared";
import { describe, expect, it } from "vitest";
import { makeShareLink, makeSharedNote, makeVersion, makeVersionSummary, shareList, versionsPage } from "./fixtures";

describe("share fixtures", () => {
  it("Unit: makeShareLink is valid and tokens differ", () => {
    const a = makeShareLink();
    const b = makeShareLink({ viewCount: 3 });

    expect(shareLinkSchema.safeParse(a).success).toBe(true);
    expect(shareLinkSchema.safeParse(b).success).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.id).not.toBe(b.id);
  });

  it("Unit: shareList and makeSharedNote are valid", () => {
    expect(shareLinkListResponseSchema.safeParse(shareList([makeShareLink()])).success).toBe(true);
    expect(sharedNoteSchema.safeParse(makeSharedNote()).success).toBe(true);
  });
});

describe("version fixtures", () => {
  it("Unit: version fixtures are valid against the shared schemas", () => {
    const summary = makeVersionSummary({ versionNumber: 3 });

    expect(noteVersionSummarySchema.safeParse(summary).success).toBe(true);
    expect(noteVersionListResponseSchema.safeParse(versionsPage([summary], { total: 45 })).success).toBe(true);
    expect(noteVersionSchema.safeParse(makeVersion({ versionNumber: 2 })).success).toBe(true);
    expect(makeVersionSummary({ versionNumber: 1 }).createdAt).not.toBe(summary.createdAt);
  });
});
