import { test } from "node:test";
import assert from "node:assert/strict";
import * as database from "../src/lib/db";

test("PostgreSQL pool is one connection per Vercel instance", () => {
  const poolSize = database.postgresPoolMax;
  assert.equal(typeof poolSize, "function", "pool sizing must be configurable");
  if (typeof poolSize === "function") {
    assert.equal(poolSize(true), 1);
    assert.equal(poolSize(false), 8);
  }
});
