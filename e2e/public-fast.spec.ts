import { test, expect } from "@playwright/test";

test("public config and signed-out state do not require a database", async ({ request }) => {
  const config = await request.get("/api/config");
  expect(config.status()).toBe(200);
  expect(typeof (await config.json()).demoEnabled).toBe("boolean");
  const state = await request.get("/api/state");
  expect(state.status()).toBe(401);
  expect((await state.json()).error).toBe("Please sign in");
});
