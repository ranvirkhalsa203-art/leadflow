import { test, expect } from "@playwright/test";

test("public landing page leads into the workspace and section URLs work", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain("nonce-");
  expect(response?.headers()["content-security-policy"]).not.toContain(
    "script-src 'self' 'unsafe-inline'",
  );
  await expect(
    page.getByRole("heading", {
      name: /little things that keep business moving/i,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(
    (
      await page.request.get("/api/auth/verify?token=" + "a".repeat(64))
    ).status(),
  ).toBe(401);
  expect((await page.request.get("/api/health")).status()).toBe(200);
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.getByRole("button", { name: "Leads", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/leads$/);
  await expect(
    page.getByRole("heading", { name: "Leads", exact: true }),
  ).toBeVisible();
});

test("delayed mutations never show one account’s data after switching accounts", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  let release!: () => void;
  let captured!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const received = new Promise<void>((r) => {
    captured = r;
  });
  await page.route("**/api/command", async (route) => {
    const response = await route.fetch();
    captured();
    await gate;
    await route.fulfill({ response });
  });
  await page
    .getByRole("combobox", { name: "Status for Natali Craig" })
    .selectOption("won");
  await received;
  await page.getByRole("button", { name: "Sign out" }).click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Workspace name").fill("Isolated new business");
  await page
    .getByLabel("Email address")
    .fill(`isolated-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("another-good-password-2026");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const response = page.waitForResponse("**/api/command");
  release();
  await (await response).finished();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText("Isolated new business", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Natali Craig", { exact: true })).toHaveCount(0);
});
test("unauthenticated requests and foreign origins are rejected", async ({
  request,
}) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  expect(
    (
      await request.post("/api/command", {
        headers: { origin: "https://evil.example" },
        data: {
          type: "feedback.create",
          category: "General feedback",
          message: "bad request",
        },
      })
    ).status(),
  ).toBe(403);
});
test("register, lead, follow-up, invoice and payment persist after reload", async ({
  page,
}) => {
  await page.goto("/app");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Workspace name").fill("Journey Studio");
  await page
    .getByLabel("Email address")
    .fill(`journey-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A-good-password-2026!");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add lead", exact: true })
    .first()
    .click();
  await page.getByLabel("Contact name").fill("Asha Mehta");
  await page.getByLabel("Company").fill("Orbit Studio");
  await page.getByLabel("Contact email").fill("asha@example.com");
  await page.getByLabel("Deal value").fill("5000");
  await page.getByRole("button", { name: "Save lead" }).click();
  await page.getByRole("button", { name: "Follow-ups", exact: true }).click();
  await page
    .getByRole("button", { name: "Schedule follow-up", exact: true })
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Client", exact: true })
    .selectOption({ label: "Asha Mehta · Orbit Studio" });
  await page.getByLabel("Follow-up title").fill("Discuss proposal");
  await page.getByRole("button", { name: "Save follow-up" }).click();
  await page.getByRole("button", { name: "Complete Discuss proposal" }).click();
  await page.getByRole("button", { name: /Completed/ }).click();
  await expect(
    page.getByText("Discuss proposal", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await page
    .getByRole("button", { name: "New invoice", exact: true })
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Client", exact: true })
    .selectOption({ label: "Asha Mehta · Orbit Studio" });
  await page.getByLabel("Description 1").fill("Brand design");
  await page.getByLabel("Unit price 1").fill("5000");
  await page.getByRole("button", { name: "Save invoice" }).click();
  await page.getByRole("button", { name: "Issue INV-0001" }).click();
  await page
    .getByRole("button", { name: "Record payment for INV-0001" })
    .click();
  await page.getByLabel("Amount received").fill("2000");
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(
    page.getByRole("table").getByText("partial", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Revenue", exact: true }).click();
  await expect(page.getByText("₹2,000.00").first()).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
test("sample workspace works on mobile and keeps content inside viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  expect(
    (await page.locator(".stat > strong").first().boundingBox())!.height,
  ).toBeLessThan(35);
  await page.screenshot({ path: "docs/previews/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Follow-ups", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Follow-ups", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("sample quotations, email drafts, feedback and printable invoices work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/app");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/previews/dashboard.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Quotations", exact: true }).click();
  await page.getByRole("button", { name: /Issue QUO-/ }).click();
  await page.getByRole("button", { name: /Accept QUO-/ }).click();
  await page.getByRole("button", { name: "Convert to invoice" }).click();
  await expect(
    page.getByRole("table").getByText("accepted", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  const [invoice] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "View INV-0006", exact: true }).click(),
  ]);
  await expect(
    invoice.getByRole("button", { name: "Print / Save PDF" }),
  ).toBeVisible();
  await invoice.close();
  await page.getByRole("button", { name: "Email", exact: true }).click();
  await page
    .getByRole("button", { name: "Compose email", exact: true })
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Client", exact: true })
    .selectOption({ index: 1 });
  await page.getByLabel("Subject", { exact: true }).fill("Our next steps");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Thanks for the conversation. Let’s talk scope.");
  await page.getByRole("button", { name: "Save to outbox" }).click();
  await expect(page.getByText("queued", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send now" })).toBeDisabled();
  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  await page
    .getByRole("button", { name: "Share feedback", exact: true })
    .click();
  await page
    .getByLabel("Your feedback")
    .fill("A project timeline would be helpful.");
  await page.getByRole("button", { name: "Save feedback" }).click();
  await expect(
    page.getByText("A project timeline would be helpful."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: "docs/previews/dashboard-dark.png",
    fullPage: true,
  });
});

test("HTTP tenant isolation denies foreign document access and payment tampering", async ({
  playwright,
}) => {
  const headers = { origin: "http://127.0.0.1:3000", "x-leadflow": "1" };
  const a = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3000",
    extraHTTPHeaders: headers,
  });
  const b = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3000",
    extraHTTPHeaders: headers,
  });
  expect((await a.post("/api/auth/demo", { data: {} })).ok()).toBe(true);
  expect((await b.post("/api/auth/demo", { data: {} })).ok()).toBe(true);
  const state = await (await a.get("/api/state")).json();
  const doc = state.workspace.documents.find(
    (d: { kind: string; status: string }) =>
      d.kind === "invoice" && d.status === "issued",
  );
  expect((await b.get(`/documents/${doc.id}`)).status()).toBe(404);
  expect(
    (
      await b.post("/api/command", {
        data: { type: "document.issue", id: doc.id },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await a.post("/api/command", {
        data: {
          type: "payment.create",
          documentId: doc.id,
          amount: doc.total + 1,
          method: "Cash",
          reference: "",
          idempotencyKey: "tamper-payment-123",
        },
      })
    ).status(),
  ).toBe(400);
  const c = {
    type: "payment.create",
    documentId: doc.id,
    amount: 100,
    method: "Cash",
    reference: "once",
    idempotencyKey: "repeat-payment-123",
  };
  const responses = await Promise.all([
    a.post("/api/command", { data: c }),
    a.post("/api/command", { data: c }),
  ]);
  expect(responses.every((r) => r.ok())).toBe(true);
  const after = await (await a.get("/api/state")).json();
  expect(
    after.workspace.payments.filter(
      (p: { idempotencyKey: string }) => p.idempotencyKey === c.idempotencyKey,
    ),
  ).toHaveLength(1);
  await a.dispose();
  await b.dispose();
});
