import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  register,
  resetPassword,
  verifyEmail,
  deleteAccount,
  authenticate,
  login,
} from "../src/lib/auth";
import { query } from "../src/lib/db";

process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "leadflow-atomic-")),
  "test.sqlite",
);

async function failStatement(table: string, event: string, id: string) {
  const column = table === "lf_sessions" ? "user_id" : "id";
  const record = event === "DELETE" ? "OLD" : "NEW";
  const condition = `${record}.${column} = '${id}'`;
  if (process.env.DATABASE_URL) {
    await query(
      "CREATE OR REPLACE FUNCTION lf_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$",
    );
    await query(
      `CREATE TRIGGER lf_test_failure BEFORE ${event} ON ${table} FOR EACH ROW WHEN (${condition}) EXECUTE FUNCTION lf_test_reject()`,
    );
  } else {
    await query(
      `CREATE TRIGGER lf_test_failure BEFORE ${event} ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT, 'injected failure'); END`,
    );
  }
  return async () => {
    await query(
      `DROP TRIGGER lf_test_failure${process.env.DATABASE_URL ? ` ON ${table}` : ""}`,
    );
    if (process.env.DATABASE_URL) await query("DROP FUNCTION lf_test_reject()");
  };
}

test("auth mutations roll back token use, password changes and session deletion on failure", async () => {
  const account = await register({
    name: "Atomic shop",
    email: "atomic@example.com",
    password: "original-password-123",
  });
  const original = (
    await query("SELECT password FROM lf_users WHERE id=$1", [account.user.id])
  ).rows[0].password;
  for (const purpose of ["verify", "reset"] as const) {
    const token = (purpose === "verify" ? "c" : "d").repeat(64);
    const hash = createHash("sha256").update(token).digest("hex");
    await query(
      "INSERT INTO lf_auth_tokens (token_hash,user_id,purpose,expires_at,consumed_at) VALUES ($1,$2,$3,$4,NULL)",
      [
        hash,
        account.user.id,
        purpose,
        new Date(Date.now() + 60000).toISOString(),
      ],
    );
    const undo = await failStatement(
      purpose === "verify" ? "lf_users" : "lf_sessions",
      purpose === "verify" ? "UPDATE" : "DELETE",
      account.user.id,
    );
    try {
      await assert.rejects(
        () =>
          purpose === "verify"
            ? verifyEmail(token)
            : resetPassword(token, "replacement-password-123"),
        /injected failure/,
      );
    } finally {
      await undo();
    }
    assert.equal(
      (
        await query(
          "SELECT consumed_at FROM lf_auth_tokens WHERE token_hash=$1",
          [hash],
        )
      ).rows[0].consumed_at,
      null,
    );
    assert.equal(
      (
        await query("SELECT password FROM lf_users WHERE id=$1", [
          account.user.id,
        ])
      ).rows[0].password,
      original,
    );
    assert.ok(await authenticate(account.token));
  }
  const undo = await failStatement(
    "lf_workspaces",
    "DELETE",
    account.user.workspaceId,
  );
  try {
    await assert.rejects(
      () => deleteAccount(account.user.id, "original-password-123"),
      /injected failure/,
    );
  } finally {
    await undo();
  }
  assert.ok(await authenticate(account.token));
  assert.equal(
    (await query("SELECT id FROM lf_users WHERE id=$1", [account.user.id])).rows
      .length,
    1,
  );
});

test("a concurrent old-password login cannot survive password reset", async () => {
  const account = await register({ name: "Concurrent shop", email: "atomic-race@example.com", password: "original-password-123" });
  const token = "e".repeat(64);
  await query("INSERT INTO lf_auth_tokens (token_hash,user_id,purpose,expires_at,consumed_at) VALUES ($1,$2,'reset',$3,NULL)", [createHash("sha256").update(token).digest("hex"), account.user.id, new Date(Date.now() + 60000).toISOString()]);
  const [attempt, reset] = await Promise.allSettled([
    login("atomic-race@example.com", "original-password-123"),
    resetPassword(token, "replacement-password-123"),
  ]);
  assert.equal(reset.status, "fulfilled");
  if (attempt.status === "fulfilled") assert.equal(await authenticate(attempt.value.token), null);
  assert.equal(await authenticate(account.token), null);
  assert.ok(await login("atomic-race@example.com", "replacement-password-123"));
});
