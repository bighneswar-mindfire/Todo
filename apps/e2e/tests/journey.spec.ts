import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { E2E_PASSWORD, uniqueEmail } from "../src/identity.ts";

const email = uniqueEmail();
const runId = Date.now().toString(36);
const noteTitle = `Journey note ${runId}`;
const noteBody = "Pelican migration notes";
const autosavedText = " autosaved addition";
const tagName = `tag-${runId}`;

let context: BrowserContext;
let page: Page;

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
});
