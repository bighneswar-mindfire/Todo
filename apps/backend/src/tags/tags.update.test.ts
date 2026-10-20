import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createTag, registerAndLogin, type TestUser } from "../notes/test-helpers.js";

describe("tags: update tag", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  const patch = (user: TestUser, id: string, body: unknown) =>
    request(t.app).patch(`/tags/${id}`).set(auth(user)).send(body as object);

  it("Rename and recolor", async () => {
    const user = await registerAndLogin(t.app);
    const tag = await createTag(t.app, user, { name: "Old" });
    const res = await patch(user, tag.id, { name: "New", color: "#00ff00" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: tag.id, name: "New", color: "#00ff00" });
  });

  it("Empty patch rejected", async () => {
    const user = await registerAndLogin(t.app);
    const tag = await createTag(t.app, user);
    const res = await patch(user, tag.id, {});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Rename to existing name rejected", async () => {
    const user = await registerAndLogin(t.app);
    await createTag(t.app, user, { name: "Taken" });
    const other = await createTag(t.app, user, { name: "Other" });
    const res = await patch(user, other.id, { name: "Taken" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TAG_NAME_TAKEN");
  });

  it("Renaming to its own current name succeeds", async () => {
    const user = await registerAndLogin(t.app);
    const tag = await createTag(t.app, user, { name: "Same" });
    const res = await patch(user, tag.id, { name: "Same", color: "#112233" });
    expect(res.status).toBe(200);
    expect(res.body.color).toBe("#112233");
  });

  it("Other user's tag hidden on update", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    const tag = await createTag(t.app, alice, { name: "Mine" });
    const res = await patch(bob, tag.id, { name: "Stolen" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const row = await t.prisma.tag.findUnique({ where: { id: tag.id } });
    expect(row?.name).toBe("Mine");
  });
});
