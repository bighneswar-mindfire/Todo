import { expect, test } from "@playwright/test";
import { uniqueEmail } from "../src/identity.ts";

test("Unauthenticated visit is redirected to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("Registration with an invalid password is rejected", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});
