import { createHash } from "node:crypto";
import type { Connection } from "./db";

export type Migration = { id: string; statements: string[] };
export const migrations: Migration[] = [
  { id: "001_lead_phone", statements: ["ALTER TABLE lf_leads ADD COLUMN phone TEXT NOT NULL DEFAULT ''"] },
];

/** Additive migrations: serialize runners and commit schema plus marker together. */
export async function runMigrations(connection: Connection, steps = migrations) {
  await connection.transaction(async (tx) => {
    if (process.env.DATABASE_URL) await tx.query("SELECT pg_advisory_xact_lock(1827041101)");
    await tx.query("CREATE TABLE IF NOT EXISTS lf_schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)");
    if (process.env.DATABASE_URL) await tx.query("ALTER TABLE lf_schema_migrations ENABLE ROW LEVEL SECURITY");
    for (const step of steps) {
      const checksum = createHash("sha256").update(JSON.stringify(step.statements)).digest("hex");
      const existing = await tx.query("SELECT checksum FROM lf_schema_migrations WHERE id=$1", [step.id]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Database migration checksum mismatch: ${step.id}`);
        continue;
      }
      for (const statement of step.statements) await tx.query(statement);
      await tx.query("INSERT INTO lf_schema_migrations (id,checksum,applied_at) VALUES ($1,$2,$3)", [step.id, checksum, new Date().toISOString()]);
    }
  });
}
