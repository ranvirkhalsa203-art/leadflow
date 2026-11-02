import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "leadflow-test-")),
  "test.sqlite",
);
import {
  register,
  login,
  authenticate,
  logout,
  verifyEmail,
  resetPassword,
  deleteAccount,
} from "../src/lib/auth";
import { getWorkspace, updateWorkspace, query } from "../src/lib/db";
import { applyCommand, emptyWorkspace } from "../src/lib/domain";

test("real sessions protect two separate workspaces and revoke on logout", async () => {
  const a = await register({
    name: "Studio A",
    email: "a@example.com",
    password: "a-secure-password-123",
    currency: "INR",
  });
  const b = await register({
    name: "Studio B",
    email: "b@example.com",
    password: "b-secure-password-123",
    currency: "USD",
  });
  assert.ok(await authenticate(a.token));
  assert.equal(await authenticate("invalid"), null);
  await assert.rejects(() => login("a@example.com", "wrong-password"));
  const logged = await login("A@example.com", "a-secure-password-123");
  assert.equal(logged.user.workspaceId, a.user.workspaceId);
  await updateWorkspace(a.user.workspaceId, (s) =>
    applyCommand(s, {
      type: "lead.create",
      name: "Private client",
      company: "Acme",
      email: "c@example.com",
      value: 1200,
      source: "Website",
    }),
  );
  assert.equal((await getWorkspace(b.user.workspaceId)).leads.length, 0);
  const lead = (await getWorkspace(a.user.workspaceId)).leads[0];
  await assert.rejects(
    () =>
      updateWorkspace(b.user.workspaceId, (s) =>
        applyCommand(s, { type: "lead.update", id: lead.id, status: "won" }),
      ),
    /not found/,
  );
  await logout(a.token);
  assert.equal(await authenticate(a.token), null);
});

test("concurrent workspace writes preserve both records", async () => {
  const a = await login("a@example.com", "a-secure-password-123");
  await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      updateWorkspace(a.user.workspaceId, (s) =>
        applyCommand(s, {
          type: "feedback.create",
          category: "General feedback",
          message: `Concurrent feedback ${i}`,
        }),
      ),
    ),
  );
  assert.equal((await getWorkspace(a.user.workspaceId)).feedback.length, 5);
});

test("repeated signup attempts for one email do not block a different business", async () => {
  for (let i = 0; i < 100; i++)
    await register({
      name: "Studio A",
      email: "a@example.com",
      password: "a-secure-password-123",
      currency: "INR",
    }).catch(() => {});
  const fresh = await register({
    name: "Fresh studio",
    email: "fresh@example.com",
    password: "another-secure-password",
    currency: "INR",
  });
  assert.ok(fresh.user.workspaceId);
});

test("workspace revisions increase monotonically so clients can reject stale responses", async () => {
  const a = await login("b@example.com", "b-secure-password-123");
  const before = await getWorkspace(a.user.workspaceId);
  const after = await updateWorkspace(a.user.workspaceId, (s) =>
    applyCommand(s, {
      type: "feedback.create",
      category: "General feedback",
      message: "Another suggestion",
    }),
  );
  assert.equal(after.revision, before.revision + 1);
});

test("legacy full workspace snapshots migrate to relational records once", async () => {
  const legacy = emptyWorkspace("Legacy Studio", "INR");
  legacy.schemaVersion = 3;
  legacy.leads.push({
    id: "legacy-lead",
    name: "Old client",
    company: "Legacy Co",
    email: "old@example.com",
    value: 42000,
    source: "Import",
    state: "Punjab",
    status: "qualified",
    createdAt: "2026-10-01T00:00:00.000Z",
  });
  legacy.feedback.push({
    id: "legacy-feedback",
    category: "General feedback",
    message: "Keep this record",
    createdAt: "2026-10-02T00:00:00.000Z",
  });
  await query(
    "INSERT INTO lf_workspaces (id,data,version,entities_migrated) VALUES ($1,$2,7,0)",
    ["legacy-workspace", JSON.stringify(legacy)],
  );

  const migrated = await getWorkspace("legacy-workspace");
  assert.equal(migrated.revision, 7);
  assert.equal(migrated.leads[0].id, "legacy-lead");
  assert.equal(migrated.feedback[0].message, "Keep this record");
  assert.equal(migrated.schemaVersion, 4);

  const stored = await query(
    "SELECT data,entities_migrated FROM lf_workspaces WHERE id=$1",
    ["legacy-workspace"],
  );
  const metadata = JSON.parse(String(stored.rows[0].data));
  assert.equal(Number(stored.rows[0].entities_migrated), 1);
  assert.equal("leads" in metadata, false);
  assert.equal("feedback" in metadata, false);
  assert.equal((await query("SELECT id FROM lf_leads WHERE workspace_id=$1", ["legacy-workspace"])).rows.length, 1);
  assert.equal((await query("SELECT id FROM lf_feedback WHERE workspace_id=$1", ["legacy-workspace"])).rows.length, 1);
});

test("workspace records larger than the former 5 MB limit persist", async () => {
  const owner = await login("b@example.com", "b-secure-password-123");
  const payload = "x".repeat(4100);
  const extra = Array.from({ length: 1300 }, (_, i) => ({
    id: `large-${i}`,
    category: "General feedback",
    message: payload,
    createdAt: "2026-10-03T00:00:00.000Z",
  }));
  const updated = await updateWorkspace(owner.user.workspaceId, (workspace) => ({
    ...workspace,
    feedback: [...workspace.feedback, ...extra],
  }));
  assert.ok(JSON.stringify(updated.feedback).length > 5_000_000);
  const reloaded = await getWorkspace(owner.user.workspaceId);
  assert.equal(reloaded.feedback.length, 1301);
  assert.equal(reloaded.feedback.at(-1)?.message.length, payload.length);
});

test("email verification requires a valid one-use token and reset revokes all sessions", async () => {
  const pending = await register(
    {
      name: "Pending studio",
      email: "pending@example.com",
      password: "pending-password-123",
      currency: "INR",
    },
    true,
  );
  await assert.rejects(
    () => login("pending@example.com", "pending-password-123"),
    /verify your email/i,
  );
  const token = "a".repeat(64);
  const hash = createHash("sha256").update(token).digest("hex");
  await query(
    "INSERT INTO lf_auth_tokens (token_hash,user_id,purpose,expires_at,consumed_at) VALUES ($1,$2,'verify',$3,NULL)",
    [hash, pending.user.id, new Date(Date.now() + 60_000).toISOString()],
  );
  await verifyEmail(token);
  await assert.rejects(() => verifyEmail(token), /invalid or expired/i);
  const session = await login("pending@example.com", "pending-password-123");
  const resetToken = "b".repeat(64);
  const resetHash = createHash("sha256").update(resetToken).digest("hex");
  await query(
    "INSERT INTO lf_auth_tokens (token_hash,user_id,purpose,expires_at,consumed_at) VALUES ($1,$2,'reset',$3,NULL)",
    [resetHash, pending.user.id, new Date(Date.now() + 60_000).toISOString()],
  );
  await resetPassword(resetToken, "replacement-password-456");
  assert.equal(await authenticate(session.token), null);
  await assert.rejects(
    () => resetPassword(resetToken, "another-password-789"),
    /invalid or expired/i,
  );
  assert.ok(await login("pending@example.com", "replacement-password-456"));
});

test("login throttling is scoped to the trusted IP and email pair", async () => {
  for (let i = 0; i < 8; i++)
    await login("b@example.com", "incorrect-password", "192.0.2.10").catch(
      () => {},
    );
  await assert.rejects(
    () => login("b@example.com", "incorrect-password", "192.0.2.10"),
    /too many attempts/i,
  );
  assert.ok(
    await login("b@example.com", "b-secure-password-123", "192.0.2.11"),
  );
});

test("account deletion requires the password and removes only that workspace", async () => {
  const owner = await register({
    name: "Closing studio",
    email: "closing@example.com",
    password: "closing-password-123",
    currency: "INR",
  });
  await assert.rejects(
    () => deleteAccount(owner.user.id, "wrong-password"),
    /password is incorrect/i,
  );
  assert.ok(await authenticate(owner.token));
  await deleteAccount(owner.user.id, "closing-password-123");
  assert.equal(await authenticate(owner.token), null);
  await assert.rejects(
    () => getWorkspace(owner.user.workspaceId),
    /not found/i,
  );
  assert.ok(
    await authenticate(
      (await login("a@example.com", "a-secure-password-123")).token,
    ),
  );
});

test("sample invoices with optional fields persist and reload", async () => {
  const { sampleWorkspace } = await import("../src/lib/seed");
  const owner = await register({name:"Sample regression",email:"sample-regression@example.com",password:"sample-regression-123",currency:"INR"});
  const sample = sampleWorkspace();
  await updateWorkspace(owner.user.workspaceId, () => sample);
  const saved = await getWorkspace(owner.user.workspaceId);
  assert.equal(saved.documents.length, sample.documents.length);
  assert.deepEqual(saved.documents.map(d => d.items), sample.documents.map(d => d.items));
});
