import { describe, expect, it } from "vitest";
import { allCalls, callsTo, json, route } from "@/test/fake-api";
import { doc, makeFullNote, makeVersion, makeVersionSummary, paragraph, signIn, versionsPage } from "@/test/fixtures";
import { getVersion, listVersions, restoreVersion } from "./versions";

const NOTE = "00000000-0000-4000-8000-0000000000a1";

describe("versions api", () => {
  it("List sends page and limit", async () => {
    signIn({ accessToken: "access-9" });
    const page = versionsPage([makeVersionSummary({ versionNumber: 2 })], { page: 2, limit: 20, total: 21 });
    route(`GET /notes/${NOTE}/versions`, () => json(200, page));

    await expect(listVersions(NOTE, 2, 20)).resolves.toEqual(page);

    const [call] = callsTo(`GET /notes/${NOTE}/versions`);
    expect(call?.query.get("page")).toBe("2");
    expect(call?.query.get("limit")).toBe("20");
    expect(call?.headers.get("Authorization")).toBe("Bearer access-9");
  });

  it("Get sends the version number", async () => {
    signIn({ accessToken: "access-9" });
    const version = makeVersion({ noteId: NOTE, versionNumber: 2 });
    route(`GET /notes/${NOTE}/versions/2`, () => json(200, version));

    await expect(getVersion(NOTE, 2)).resolves.toEqual(version);

    expect(callsTo(`GET /notes/${NOTE}/versions/2`)[0]?.headers.get("Authorization")).toBe("Bearer access-9");
  });

  it("Restore sends a post without a body", async () => {
    signIn({ accessToken: "access-9" });
    const note = makeFullNote({ id: NOTE, title: "Draft", content: doc(paragraph("Old")) });
    route(`POST /notes/${NOTE}/versions/2/restore`, () => json(200, note));

    await expect(restoreVersion(NOTE, 2)).resolves.toEqual(note);

    const [call] = callsTo(`POST /notes/${NOTE}/versions/2/restore`);
    expect(call?.body).toBeUndefined();
    expect(call?.headers.get("Authorization")).toBe("Bearer access-9");
  });

  it("Invalid version number sends no request", async () => {
    signIn();

    await expect(getVersion(NOTE, 0)).rejects.toThrow();
    await expect(getVersion(NOTE, 1.5)).rejects.toThrow();
    await expect(restoreVersion(NOTE, 0)).rejects.toThrow();
    await expect(restoreVersion(NOTE, 1.5)).rejects.toThrow();

    expect(allCalls()).toHaveLength(0);
  });

  it("Unit: list rejects a malformed response", async () => {
    signIn();
    route(`GET /notes/${NOTE}/versions`, () => json(200, { items: [{ versionNumber: "x" }] }));

    await expect(listVersions(NOTE, 1, 20)).rejects.toThrow();
  });
});
