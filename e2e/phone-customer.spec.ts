import { test, expect } from "@playwright/test";

test("phone-only customer saves, reloads and is searchable without a welcome email", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Business name").fill("Phone Shop");
  await page.getByLabel("Email address").fill(`phone-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("A-good-password-2026!");
  await page.getByRole("button", { name: "Create business", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add lead", exact: true }).first().click();
  await page.getByLabel("Contact name").fill("Phone Customer");
  await page.getByLabel("Phone (include country code)").fill("+919876543210");
  await page.getByRole("button", { name: "Save lead", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save lead", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Leads", exact: true }).click();
  await page.reload();
  await page.getByPlaceholder("Search name, phone, company or email…").fill("9876543210");
  await expect(page.getByRole("link", { name: "Open WhatsApp draft for Phone Customer" })).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  expect(state.workspace.leads[0].email).toBe("");
  expect(state.workspace.outbox).toHaveLength(0);
});
