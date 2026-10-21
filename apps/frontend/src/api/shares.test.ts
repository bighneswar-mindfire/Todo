import { describe, expect, it } from "vitest";
import { callsTo, empty, json, route } from "@/test/fake-api";
import { makeShareLink, makeSharedNote, shareList, signIn } from "@/test/fixtures";
import { createShareLink, getSharedNote, listShareLinks, revokeShareLink } from "./shares";

const NOTE = "00000000-0000-4000-8000-0000000000a1";
const SHARE = "00000000-0000-4000-8000-0000000000b1";

describe("sharing api", () => {
  it("Create sends no body without expiry", async () => {
    signIn({ accessToken: "access-9" });
    route(`POST /notes/${NOTE}/shares`, () => json(201, makeShareLink()));

    await createShareLink(NOTE);

    const [call] = callsTo(`POST /notes/${NOTE}/shares`);
    expect(call?.body).toBeUndefined();
    expect(call?.headers.get("Authorization")).toBe("Bearer access-9");
  });

  it("Create sends the expiry", async () => {
    signIn();
    route(`POST /notes/${NOTE}/shares`, () => json(201, makeShareLink()));
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

    await createShareLink(NOTE, expiresAt);

    expect(callsTo(`POST /notes/${NOTE}/shares`)[0]?.body).toEqual({ expiresAt });
  });

  it("List returns validated links", async () => {
    signIn();
    const links = [makeShareLink(), makeShareLink({ viewCount: 3 })];
    route(`GET /notes/${NOTE}/shares`, () => json(200, shareList(links)));

    await expect(listShareLinks(NOTE)).resolves.toEqual(links);
  });

  it("Revoke sends delete", async () => {
    signIn({ accessToken: "access-9" });
    route(`DELETE /notes/${NOTE}/shares/${SHARE}`, () => empty(204));

    await revokeShareLink(NOTE, SHARE);

    const [call] = callsTo(`DELETE /notes/${NOTE}/shares/${SHARE}`);
    expect(call).toBeDefined();
    expect(call?.headers.get("Authorization")).toBe("Bearer access-9");
  });

  it("Public note function sends no credentials", async () => {
    signIn({ accessToken: "access-9" });
    const token = makeShareLink().token;
    const note = makeSharedNote();
    route(`GET /shared/${token}`, () => json(200, note));

    await expect(getSharedNote(token)).resolves.toEqual(note);
    expect(callsTo(`GET /shared/${token}`)[0]?.headers.has("Authorization")).toBe(false);
  });

  it("Unit: list rejects a malformed response", async () => {
    signIn();
    route(`GET /notes/${NOTE}/shares`, () => json(200, { items: [{ id: "x" }] }));

    await expect(listShareLinks(NOTE)).rejects.toThrow();
  });
});
