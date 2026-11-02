import { test } from "node:test";
import assert from "node:assert/strict";
import { localDate, preferNewerWorkspace } from "../src/lib/client-utils";
import { emptyWorkspace } from "../src/lib/domain";
test("local date uses the local calendar day, not UTC", () => {
  process.env.TZ = "Asia/Kolkata";
  assert.equal(localDate(new Date("2026-10-31T19:30:00Z")), "2026-11-01");
  assert.equal(localDate(new Date("2026-12-31T19:30:00Z")), "2027-01-01");
});
test("out-of-order responses cannot replace a newer workspace", () => {
  const old = emptyWorkspace("Old", "INR");
  old.revision = 1;
  const next = emptyWorkspace("New", "INR");
  next.revision = 2;
  assert.equal(preferNewerWorkspace(next, old).name, "New");
  assert.equal(preferNewerWorkspace(old, next).name, "New");
});
