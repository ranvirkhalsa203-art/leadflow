import { test, expect } from "@playwright/test";

test("production app hydrates with fresh matching script nonces", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const nonces: string[] = [];
  for (let visit = 0; visit < 2; visit++) {
    const response = await page.goto("/app");
    expect(response?.status()).toBe(200);
    const policy = response!.headers()["content-security-policy"];
    expect(policy).not.toContain("unsafe-eval");
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    nonces.push(nonce!);
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    const scriptNonces = await page.locator("script").evaluateAll((scripts) =>
      scripts.filter((script): script is HTMLScriptElement => script instanceof HTMLScriptElement)
        .filter((script) => !script.type || /javascript|module/.test(script.type))
        .map((script) => script.nonce),
    );
    expect(scriptNonces.length).toBeGreaterThan(0);
    expect(scriptNonces.every((value) => value === nonce)).toBe(true);
  }
  expect(nonces[0]).not.toBe(nonces[1]);
  expect(errors).toEqual([]);
});
