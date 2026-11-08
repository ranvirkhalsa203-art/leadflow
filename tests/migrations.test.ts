import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query, transaction } from "../src/lib/db";
import { runMigrations } from "../src/lib/migrations";
import { whatsappDraft } from "../src/lib/contact";

process.env.SQLITE_PATH = join(mkdtempSync(join(tmpdir(), "leadflow-migration-")), "test.sqlite");

test("schema changes roll back with their marker, retry safely and reject edited history", async () => {
  const db = { query, transaction };
  await query("CREATE TABLE lf_test_migration_probe (id TEXT PRIMARY KEY)");
  if (process.env.DATABASE_URL) {
    const registry = await query("SELECT relrowsecurity FROM pg_class WHERE oid='lf_schema_migrations'::regclass");
    assert.equal(registry.rows[0].relrowsecurity, true);
  }
  await query("INSERT INTO lf_test_migration_probe (id) VALUES ('keep-me')");
  const id = "test_atomic_migration";
  try {
    await assert.rejects(() => runMigrations(db, [{ id, statements: ["ALTER TABLE lf_test_migration_probe ADD COLUMN phone TEXT DEFAULT ''", "SELECT * FROM lf_intentionally_missing_table"] }]));
    assert.equal((await query("SELECT id FROM lf_schema_migrations WHERE id=$1", [id])).rows.length, 0);
    await assert.rejects(() => query("SELECT phone FROM lf_test_migration_probe"));
    const step = { id, statements: ["ALTER TABLE lf_test_migration_probe ADD COLUMN phone TEXT DEFAULT ''"] };
    await runMigrations(db, [step]);
    await runMigrations(db, [step]);
    assert.equal((await query("SELECT id FROM lf_test_migration_probe")).rows[0].id, "keep-me");
    assert.equal((await query("SELECT id FROM lf_schema_migrations WHERE id=$1", [id])).rows.length, 1);
    await assert.rejects(() => runMigrations(db, [{ id, statements: ["SELECT 1"] }]), /checksum mismatch/);
  } finally {
    await query("DROP TABLE lf_test_migration_probe");
    await query("DELETE FROM lf_schema_migrations WHERE id=$1", [id]);
  }
});

test("WhatsApp drafts validate numbers and encode message text without claiming delivery", () => {
  assert.equal(whatsappDraft("9876543210", "Yash", "Shop"), null);
  assert.equal(whatsappDraft(undefined, "Yash", "Shop"), null);
  const url = new URL(whatsappDraft("+91 98765 43210", "Yash & family", "TV Shop")!);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/919876543210");
  assert.match(url.searchParams.get("text")!, /Yash & family/);
});
