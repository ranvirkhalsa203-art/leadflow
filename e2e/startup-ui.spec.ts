import { test, expect } from "@playwright/test";

test("sign-in has no external font dependency and works with unavailable browser storage", async ({ page }) => {
  const externalFonts: string[] = [];
  page.on("request", r => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) externalFonts.push(r.url()); });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  });
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  expect(externalFonts).toEqual([]);
});

test("mobile sign-in can reveal password and business setup is plainly labelled", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("example-password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByLabel("Business name", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
