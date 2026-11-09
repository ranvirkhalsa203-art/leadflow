import { test, expect } from "@playwright/test";

test("stalled workspace load offers retry and recovers", async ({ page }) => {
  let stalled = true;
  await page.route("**/api/state", async route => {
    if (stalled) return;
    await route.continue();
  });
  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Retry loading" })).toBeVisible({ timeout: 18000 });
  stalled = false;
  await page.getByRole("button", { name: "Retry loading" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
});
