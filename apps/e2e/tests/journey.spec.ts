import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { WEB_URL } from "../src/env.ts";
import { E2E_PASSWORD, uniqueEmail } from "../src/identity.ts";

const email = uniqueEmail();
const runId = Date.now().toString(36);
const noteTitle = `Journey note ${runId}`;
const noteBody = "Pelican migration notes";
const autosavedText = " autosaved addition";
const tagName = `tag-${runId}`;

let context: BrowserContext;
let page: Page;
let anonymous: BrowserContext;
let visitor: Page;
let shareUrl = "";

async function logIn(target: Page) {
  await target.getByLabel("Email").fill(email);
  await target.getByLabel("Password").fill(E2E_PASSWORD);
  await target.getByRole("button", { name: "Log in" }).click();
}

test.describe("full user journey", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await anonymous?.close();
    await context.close();
  });

  test("Register a new account", async () => {
    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("status")).toHaveText("Account created, please log in");
  });

  test("Log in with the registered account", async () => {
    await logIn(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(email)).toBeVisible();
  });

  test("Create a note", async () => {
    await page.getByRole("link", { name: "New note" }).click();
    await page.getByLabel("Title").fill(noteTitle);
    await page.getByRole("textbox", { name: "Note content" }).fill(noteBody);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: noteTitle })).toBeVisible();
  });

  test("Edit with autosave", async () => {
    await page.getByRole("link", { name: noteTitle }).click();
    const content = page.getByRole("textbox", { name: "Note content" });
    await expect(content).toContainText(noteBody);
    await content.press("Control+End");
    await content.pressSequentially(autosavedText);
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Note content" })).toContainText(autosavedText.trim());
  });

  test("Tag a note", async () => {
    const tags = page.getByRole("group", { name: "Tags" });
    await tags.getByRole("button", { name: "New tag" }).click();
    await page.getByLabel("Tag name").fill(tagName);
    await page.getByRole("button", { name: "Create tag" }).click();
    await expect(tags.getByRole("button", { name: tagName, pressed: true })).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("listitem").filter({ hasText: noteTitle }).getByText(tagName)).toBeVisible();
  });

  test("Search with highlight", async () => {
    await page.getByRole("searchbox", { name: "Search notes" }).fill("pelican");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/search\?/);
    const result = page.getByRole("listitem").filter({ hasText: noteTitle });
    await expect(result.locator("mark").first()).toHaveText(/pelican/i);
  });

  test("Share a note", async () => {
    await page.getByRole("listitem").filter({ hasText: noteTitle }).getByRole("link", { name: noteTitle }).click();
    await page.getByRole("button", { name: "Share" }).click();
    const dialog = page.getByRole("dialog", { name: "Share this note" });
    await dialog.getByRole("button", { name: "Create link" }).click();
    const row = dialog.getByRole("row").filter({ hasText: "Never expires" });
    await expect(row.getByText("Active")).toBeVisible();
    const link = (await row.locator("span.font-mono").textContent()) ?? "";
    expect(link).toMatch(new RegExp(`^${WEB_URL}/shared/[A-Za-z0-9_-]+$`));
    shareUrl = link;
  });

  test("Anonymous visitor opens the public link", async ({ browser }) => {
    anonymous = await browser.newContext();
    visitor = await anonymous.newPage();
    await visitor.goto(shareUrl);
    await expect(visitor.getByRole("heading", { name: noteTitle })).toBeVisible();
    await expect(visitor.getByText(noteBody)).toBeVisible();
    await expect(visitor.getByRole("textbox")).toHaveCount(0);
    for (const name of ["Save", "Share", "Delete", "History"]) {
      await expect(visitor.getByRole("button", { name })).toHaveCount(0);
    }
  });

  test("Revoke the share link", async () => {
    const dialog = page.getByRole("dialog", { name: "Share this note" });
    await dialog.getByRole("button", { name: /^Revoke link created/ }).click();
    await dialog.getByRole("button", { name: /^Confirm revoke/ }).click();
    await expect(dialog.getByRole("row").filter({ hasText: "Revoked" })).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByRole("heading", { name: "This link is not available" })).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
  });

  test("View history and restore a version", async () => {
    const content = page.getByRole("textbox", { name: "Note content" });
    await content.fill("Second draft body");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.getByRole("button", { name: "History" }).click();
    const drawer = page.getByRole("dialog", { name: "Version history" });
    const previews = drawer.getByRole("button", { name: /^Preview version \d+/ });
    await expect(previews.first()).toBeVisible();
    const versionsBefore = await previews.count();
    await drawer.getByRole("button", { name: /^Preview version 1\b/ }).click();
    await expect(drawer.getByText(noteBody)).toBeVisible();
    await drawer.getByRole("button", { name: "Restore as new version" }).click();
    await drawer.getByRole("button", { name: "Confirm restore" }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Note content" })).toContainText(noteBody);
    await expect(page.getByRole("textbox", { name: "Note content" })).not.toContainText("Second draft body");
    await page.getByRole("button", { name: "History" }).click();
    const reopened = page.getByRole("dialog", { name: "Version history" });
    await expect(reopened.getByRole("button", { name: /^Preview version \d+/ })).toHaveCount(versionsBefore + 1);
    await reopened.getByRole("button", { name: "Close" }).click();
  });

  test("Delete and restore from trash", async () => {
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog", { name: "Delete this note?" }).getByRole("button", { name: "Delete note" }).click();
    await page.goto("/trash");
    await page.getByRole("button", { name: `Restore ${noteTitle}` }).click();
    await expect(page.getByRole("button", { name: `Restore ${noteTitle}` })).toHaveCount(0);
    await page.getByRole("link", { name: "Back to notes" }).click();
    const item = page.getByRole("listitem").filter({ hasText: noteTitle });
    await expect(item).toBeVisible();
    await expect(item.getByText(tagName)).toBeVisible();
  });

  test("Log out", async () => {
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
