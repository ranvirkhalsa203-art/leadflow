import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { Pool, type PoolClient } from "pg";
import {
  emptyWorkspace,
  migrateWorkspace,
  type Workspace,
  type Lead,
  type Product,
  type Document,
  type Payment,
  type InventoryMovement,
  type Mail,
} from "./domain";

type Row = Record<string, unknown>;
type QueryResult = { rows: Row[]; changes: number };
type Connection = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  transaction: <T>(work: (tx: Connection) => Promise<T>) => Promise<T>;
};
const globalDb = globalThis as typeof globalThis & {
  leadflowDb?: Promise<Connection>;
};
const isPostgres = () => Boolean(process.env.DATABASE_URL);
export const postgresPoolMax = (isVercel = Boolean(process.env.VERCEL)) =>
  isVercel ? 1 : 8;
const tables = [
  "CREATE TABLE IF NOT EXISTS lf_workspaces (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, entities_migrated INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS lf_leads (workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, sort_order BIGINT NOT NULL, name TEXT NOT NULL, company TEXT NOT NULL, email TEXT NOT NULL, value BIGINT NOT NULL, source TEXT NOT NULL, state TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(workspace_id,id))",
  "CREATE TABLE IF NOT EXISTS lf_products (workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, sort_order BIGINT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, hsn_sac TEXT NOT NULL DEFAULT '', unit_price BIGINT NOT NULL, tax_bps INTEGER NOT NULL, active INTEGER NOT NULL, track_inventory INTEGER NOT NULL, stock_on_hand_milli BIGINT NOT NULL, low_stock_at_milli BIGINT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(workspace_id,id))",
  "CREATE TABLE IF NOT EXISTS lf_followups (workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, sort_order BIGINT NOT NULL, lead_id TEXT NOT NULL, title TEXT NOT NULL, due_date TEXT NOT NULL, done INTEGER NOT NULL, PRIMARY KEY(workspace_id,id))",
  "CREATE TABLE IF NOT EXISTS lf_documents (workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, sort_order BIGINT NOT NULL, number TEXT NOT NULL, kind TEXT NOT NULL, lead_id TEXT NOT NULL, due_date TEXT NOT NULL, tax_bps INTEGER NOT NULL, subtotal BIGINT NOT NULL, tax BIGINT NOT NULL, total BIGINT NOT NULL, notes TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, quote_id TEXT, related_document_id TEXT, tax_supply TEXT, cgst BIGINT, sgst BIGINT, igst BIGINT, PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,number))",
  "CREATE TABLE IF NOT EXISTS lf_document_items (workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id) ON DELETE CASCADE, document_id TEXT NOT NULL, line_no INTEGER NOT NULL, description TEXT NOT NULL, quantity_milli BIGINT NOT NULL, unit_price BIGINT NOT NULL, tax_bps INTEGER, product_id TEXT, hsn_sac TEXT, PRIMARY KEY(workspace_id,document_id,line_no))",
  "CREATE TABLE IF NOT EXISTS lf_payments (workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, sort_order BIGINT NOT NULL, document_id TEXT NOT NULL, amount BIGINT NOT NULL, method TEXT NOT NULL, reference TEXT NOT NULL, idempotency_key TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,idempotency_key))",
  "CREATE TABLE IF NOT EXISTS lf_inventory_movements (workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, sort_order BIGINT NOT NULL, product_id TEXT NOT NULL, document_id TEXT, type TEXT NOT NULL, quantity_milli BIGINT NOT NULL, stock_after_milli BIGINT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(workspace_id,id))",
  "CREATE TABLE IF NOT EXISTS lf_feedback (workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, sort_order BIGINT NOT NULL, category TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(workspace_id,id))",
  "CREATE TABLE IF NOT EXISTS lf_outbox (workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, sort_order BIGINT NOT NULL, to_address TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL, created_at TEXT NOT NULL, last_attempt TEXT, first_attempt TEXT, error TEXT, PRIMARY KEY(workspace_id,id))",
  "CREATE TABLE IF NOT EXISTS lf_activity (workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, sort_order BIGINT NOT NULL, title TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(workspace_id,id))",
  "CREATE TABLE IF NOT EXISTS lf_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, workspace_id TEXT NOT NULL REFERENCES lf_workspaces(id), created_at TEXT)",
  "CREATE TABLE IF NOT EXISTS lf_sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES lf_users(id), expires_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS lf_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS lf_auth_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES lf_users(id) ON DELETE CASCADE, purpose TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT)",
  "CREATE INDEX IF NOT EXISTS lf_sessions_user ON lf_sessions(user_id)",
  "CREATE INDEX IF NOT EXISTS lf_leads_workspace_status ON lf_leads(workspace_id,status)",
  "CREATE INDEX IF NOT EXISTS lf_leads_workspace_email ON lf_leads(workspace_id,email)",
  "CREATE INDEX IF NOT EXISTS lf_products_workspace_active ON lf_products(workspace_id,active)",
  "CREATE INDEX IF NOT EXISTS lf_followups_workspace_due ON lf_followups(workspace_id,due_date,done)",
  "CREATE INDEX IF NOT EXISTS lf_documents_workspace_lead ON lf_documents(workspace_id,lead_id,kind,status)",
  "CREATE INDEX IF NOT EXISTS lf_document_items_workspace_doc ON lf_document_items(workspace_id,document_id,line_no)",
  "CREATE INDEX IF NOT EXISTS lf_payments_workspace_document ON lf_payments(workspace_id,document_id)",
  "CREATE INDEX IF NOT EXISTS lf_inventory_workspace_product ON lf_inventory_movements(workspace_id,product_id,created_at)",
  "CREATE INDEX IF NOT EXISTS lf_outbox_workspace_status ON lf_outbox(workspace_id,status,created_at)",
];

async function connect(): Promise<Connection> {
  let conn: Connection;
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: postgresPoolMax(),
      connectionTimeoutMillis: 10000,
    });
    const execute = async (
      client: Pool | PoolClient,
      sql: string,
      params: unknown[] = [],
    ): Promise<QueryResult> => {
      const result = await client.query(sql, params);
      return { rows: result.rows as Row[], changes: result.rowCount ?? 0 };
    };
    conn = {
      query: (sql, params = []) => execute(pool, sql, params),
      async transaction(work) {
        const client = await pool.connect();
        try {
          // Writers lock the tenant row before reading it. READ COMMITTED lets a
          // waiter see the committed workspace after obtaining that lock.
          await client.query("BEGIN");
          const tx: Connection = {
            query: (sql, params = []) => execute(client, sql, params),
            transaction: async (nested) => nested(tx),
          };
          const result = await work(tx);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      },
    };
  } else {
    if (process.env.VERCEL)
      throw new Error(
        "Configure DATABASE_URL before deploying. Local storage is not durable on Vercel.",
      );
    const { DatabaseSync } = await import("node:sqlite");
    const path = resolve(process.env.SQLITE_PATH || "./data/leadflow.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    const db: DatabaseSync = new DatabaseSync(path);
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    const execute = async (sql: string, params: unknown[] = []) => {
      const values: unknown[] = [];
      const normalized = sql.replace(/\$(\d+)/g, (_, n) => {
        values.push(sqlValue(params[Number(n) - 1]));
        return "?";
      });
      const stmt = db.prepare(normalized);
      if (/^\s*(SELECT|WITH|PRAGMA)|\bRETURNING\b/i.test(sql)) {
        const rows = stmt.all(
          ...(values as (string | number | null)[]),
        ) as Row[];
        return { rows, changes: rows.length };
      }
      const r = stmt.run(...(values as (string | number | null)[]));
      return { rows: [], changes: Number(r.changes) };
    };
    // SQLite has one connection; serialize transactions and standalone queries
    // so another request cannot observe or join a partially written workspace.
    let queue = Promise.resolve();
    const schedule = <T>(operation: () => Promise<T>): Promise<T> => {
      const result = queue.then(operation, operation);
      queue = result.then(() => undefined, () => undefined);
      return result;
    };
    conn = {
      query: (sql, params = []) => schedule(() => execute(sql, params)),
      transaction: (work) => schedule(async () => {
        db.exec("BEGIN IMMEDIATE");
        const tx: Connection = {
          query: execute,
          transaction: async (nested) => nested(tx),
        };
        try {
          const result = await work(tx);
          db.exec("COMMIT");
          return result;
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      }),
    };
  }

  for (const sql of tables) await conn.query(sql);
  if (isPostgres()) {
    await conn.query(
      "ALTER TABLE lf_workspaces ADD COLUMN IF NOT EXISTS entities_migrated INTEGER NOT NULL DEFAULT 0",
    );
    await conn.query(
      "ALTER TABLE lf_users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 1",
    );
    await conn.query(
      "ALTER TABLE lf_users ADD COLUMN IF NOT EXISTS created_at TEXT",
    );
    await conn.query(
      "ALTER TABLE lf_users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP",
    );
    for (const table of [
      "lf_workspaces", "lf_leads", "lf_products", "lf_followups",
      "lf_documents", "lf_document_items", "lf_payments",
      "lf_inventory_movements", "lf_feedback", "lf_outbox", "lf_activity",
      "lf_users", "lf_sessions", "lf_limits", "lf_auth_tokens",
    ]) await conn.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  } else {
    const workspaceColumns = await conn.query("PRAGMA table_info(lf_workspaces)");
    if (!workspaceColumns.rows.some((column) => column.name === "entities_migrated"))
      await conn.query("ALTER TABLE lf_workspaces ADD COLUMN entities_migrated INTEGER NOT NULL DEFAULT 0");
    const userColumns = await conn.query("PRAGMA table_info(lf_users)");
    if (!userColumns.rows.some((column) => column.name === "email_verified"))
      await conn.query("ALTER TABLE lf_users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1");
    if (!userColumns.rows.some((column) => column.name === "created_at"))
      await conn.query("ALTER TABLE lf_users ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP");
  }
  await migrateLegacyWorkspaces(conn);
  return conn;
}

export async function query(sql: string, params: unknown[] = []) {
  globalDb.leadflowDb ??= connect();
  return (await globalDb.leadflowDb).query(sql, params);
}

export async function checkDatabase() {
  await query("SELECT 1");
}

function workspaceMetadata(workspace: Workspace) {
  return {
    schemaVersion: workspace.schemaVersion,
    name: workspace.name,
    currency: workspace.currency,
    isDemo: workspace.isDemo,
    business: workspace.business,
    subscription: workspace.subscription,
  };
}

export async function createWorkspace(id: string, workspace: Workspace) {
  await query(
    "INSERT INTO lf_workspaces (id,data,version,entities_migrated) VALUES ($1,$2,0,1)",
    [id, JSON.stringify(workspaceMetadata(workspace))],
  );
}

function parsePayload<T>(row: Row): T {
  return {
    id: String(row.id),
    ...row,
  } as T;
}

function orderMap(rows: Row[]) {
  return new Map(rows.map((row) => [String(row.id), Number(row.sort_order)]));
}

async function readWorkspace(tx: Connection, id: string): Promise<{
  workspace: Workspace;
  version: number;
  orders: Record<string, Map<string, number>>;
}> {
  const { rows: workspaceRows } = await tx.query(
    "SELECT data,version,entities_migrated FROM lf_workspaces WHERE id=$1",
    [id],
  );
  if (!workspaceRows[0]) throw new Error("Workspace not found");
  if (Number(workspaceRows[0].entities_migrated) !== 1) {
    await migrateOneWorkspace(tx, id, String(workspaceRows[0].data));
    const refreshed = await tx.query(
      "SELECT data,version FROM lf_workspaces WHERE id=$1",
      [id],
    );
    workspaceRows[0].data = refreshed.rows[0].data;
    workspaceRows[0].version = refreshed.rows[0].version;
  }

  const [leadRows, productRows, followupRows, documentRows, lineRows,
    paymentRows, movementRows, feedbackRows, outboxRows, activityRows] =
    await Promise.all([
      tx.query("SELECT * FROM lf_leads WHERE workspace_id=$1 ORDER BY sort_order,id", [id]),
      tx.query("SELECT * FROM lf_products WHERE workspace_id=$1 ORDER BY sort_order,id", [id]),
      tx.query("SELECT * FROM lf_followups WHERE workspace_id=$1 ORDER BY sort_order,id", [id]),
      tx.query("SELECT * FROM lf_documents WHERE workspace_id=$1 ORDER BY sort_order,id", [id]),
      tx.query("SELECT * FROM lf_document_items WHERE workspace_id=$1 ORDER BY document_id,line_no", [id]),
      tx.query("SELECT * FROM lf_payments WHERE workspace_id=$1 ORDER BY sort_order,id", [id]),
      tx.query("SELECT * FROM lf_inventory_movements WHERE workspace_id=$1 ORDER BY sort_order,id", [id]),
      tx.query("SELECT * FROM lf_feedback WHERE workspace_id=$1 ORDER BY sort_order,id", [id]),
      tx.query("SELECT * FROM lf_outbox WHERE workspace_id=$1 ORDER BY sort_order,id", [id]),
      tx.query("SELECT * FROM lf_activity WHERE workspace_id=$1 ORDER BY sort_order,id", [id]),
    ]);
  const linesByDocument = new Map<string, Row[]>();
  for (const row of lineRows.rows) {
    const key = String(row.document_id);
    const list = linesByDocument.get(key) ?? [];
    list.push(row);
    linesByDocument.set(key, list);
  }
  const documents: Document[] = documentRows.rows.map((row) => ({
    id: String(row.id), number: String(row.number), kind: String(row.kind) as Document["kind"],
    leadId: String(row.lead_id), dueDate: String(row.due_date),
    items: (linesByDocument.get(String(row.id)) ?? []).map((line) => ({
      description: String(line.description), quantity: Number(line.quantity_milli) / 1000,
      unitPrice: Number(line.unit_price),
      ...(line.tax_bps === null ? {} : { taxBps: Number(line.tax_bps) }),
      ...(line.product_id ? { productId: String(line.product_id) } : {}),
      ...(line.hsn_sac ? { hsnSac: String(line.hsn_sac) } : {}),
    })),
    taxBps: Number(row.tax_bps), subtotal: Number(row.subtotal), tax: Number(row.tax),
    total: Number(row.total), notes: String(row.notes), status: String(row.status) as Document["status"],
    createdAt: String(row.created_at),
    ...(row.quote_id ? { quoteId: String(row.quote_id) } : {}),
    ...(row.related_document_id ? { relatedDocumentId: String(row.related_document_id) } : {}),
    ...(row.tax_supply ? { taxSplit: { supply: String(row.tax_supply) as NonNullable<Document["taxSplit"]>["supply"], cgst: Number(row.cgst ?? 0), sgst: Number(row.sgst ?? 0), igst: Number(row.igst ?? 0) } } : {}),
  }));
  const metadata = JSON.parse(String(workspaceRows[0].data));
  const base = emptyWorkspace(String(metadata.name), String(metadata.currency));
  const workspace = migrateWorkspace({
    ...base,
    ...metadata,
    leads: leadRows.rows.map((r) => ({ id: String(r.id), name: String(r.name), company: String(r.company), email: String(r.email), value: Number(r.value), source: String(r.source), state: String(r.state ?? ""), status: String(r.status) as Lead["status"], createdAt: String(r.created_at) })),
    products: productRows.rows.map((r) => ({ id: String(r.id), name: String(r.name), description: String(r.description), hsnSac: String(r.hsn_sac ?? ""), unitPrice: Number(r.unit_price), taxBps: Number(r.tax_bps), active: Number(r.active) === 1, trackInventory: Number(r.track_inventory) === 1, stockOnHandMilli: Number(r.stock_on_hand_milli), lowStockAtMilli: Number(r.low_stock_at_milli), createdAt: String(r.created_at) })),
    followups: followupRows.rows.map((r) => ({ id: String(r.id), leadId: String(r.lead_id), title: String(r.title), dueDate: String(r.due_date), done: Number(r.done) === 1 })),
    documents,
    payments: paymentRows.rows.map((r) => ({ id: String(r.id), documentId: String(r.document_id), amount: Number(r.amount), method: String(r.method), reference: String(r.reference), idempotencyKey: String(r.idempotency_key), createdAt: String(r.created_at) })),
    inventoryMovements: movementRows.rows.map((r) => ({ id: String(r.id), productId: String(r.product_id), ...(r.document_id ? { documentId: String(r.document_id) } : {}), type: String(r.type) as InventoryMovement["type"], quantityMilli: Number(r.quantity_milli), stockAfterMilli: Number(r.stock_after_milli), note: String(r.note), createdAt: String(r.created_at) })),
    feedback: feedbackRows.rows.map((r) => ({ id: String(r.id), category: String(r.category), message: String(r.message), createdAt: String(r.created_at) })),
    outbox: outboxRows.rows.map((r) => ({ id: String(r.id), to: String(r.to_address), subject: String(r.subject), body: String(r.body), status: String(r.status) as Mail["status"], attempts: Number(r.attempts), createdAt: String(r.created_at), ...(r.last_attempt ? { lastAttempt: String(r.last_attempt) } : {}), ...(r.first_attempt ? { firstAttempt: String(r.first_attempt) } : {}), ...(r.error ? { error: String(r.error) } : {}) })),
    activity: activityRows.rows.map((r) => ({ id: String(r.id), title: String(r.title), createdAt: String(r.created_at) })),
  });
  return {
    workspace: { ...workspace, revision: Number(workspaceRows[0].version) },
    version: Number(workspaceRows[0].version),
    orders: {
      leads: orderMap(leadRows.rows), products: orderMap(productRows.rows),
      followups: orderMap(followupRows.rows), documents: orderMap(documentRows.rows),
      payments: orderMap(paymentRows.rows), inventoryMovements: orderMap(movementRows.rows),
      feedback: orderMap(feedbackRows.rows), outbox: orderMap(outboxRows.rows),
      activity: orderMap(activityRows.rows),
    },
  };
}

function sqlValue(value: unknown): unknown {
  if (typeof value === "boolean") return value ? 1 : 0;
  return value ?? null;
}

type EntitySpec<T extends { id: string }> = {
  key: keyof Workspace & string;
  table: string;
  columns: string[];
  values: (row: T) => unknown[];
};
const entities: EntitySpec<any>[] = [
  { key: "leads", table: "lf_leads", columns: ["name","company","email","value","source","state","status","created_at"], values: (r: Lead) => [r.name,r.company,r.email,r.value,r.source,r.state,r.status,r.createdAt] },
  { key: "products", table: "lf_products", columns: ["name","description","hsn_sac","unit_price","tax_bps","active","track_inventory","stock_on_hand_milli","low_stock_at_milli","created_at"], values: (r: Product) => [r.name,r.description,r.hsnSac,r.unitPrice,r.taxBps,r.active,r.trackInventory,r.stockOnHandMilli,r.lowStockAtMilli,r.createdAt] },
  { key: "followups", table: "lf_followups", columns: ["lead_id","title","due_date","done"], values: (r: Workspace["followups"][number]) => [r.leadId,r.title,r.dueDate,r.done] },
  { key: "documents", table: "lf_documents", columns: ["number","kind","lead_id","due_date","tax_bps","subtotal","tax","total","notes","status","created_at","quote_id","related_document_id","tax_supply","cgst","sgst","igst"], values: (r: Document) => [r.number,r.kind,r.leadId,r.dueDate,r.taxBps,r.subtotal,r.tax,r.total,r.notes,r.status,r.createdAt,r.quoteId,r.relatedDocumentId,r.taxSplit?.supply,r.taxSplit?.cgst,r.taxSplit?.sgst,r.taxSplit?.igst] },
  { key: "payments", table: "lf_payments", columns: ["document_id","amount","method","reference","idempotency_key","created_at"], values: (r: Payment) => [r.documentId,r.amount,r.method,r.reference,r.idempotencyKey,r.createdAt] },
  { key: "inventoryMovements", table: "lf_inventory_movements", columns: ["product_id","document_id","type","quantity_milli","stock_after_milli","note","created_at"], values: (r: InventoryMovement) => [r.productId,r.documentId,r.type,r.quantityMilli,r.stockAfterMilli,r.note,r.createdAt] },
  { key: "feedback", table: "lf_feedback", columns: ["category","message","created_at"], values: (r: Workspace["feedback"][number]) => [r.category,r.message,r.createdAt] },
  { key: "outbox", table: "lf_outbox", columns: ["to_address","subject","body","status","attempts","created_at","last_attempt","first_attempt","error"], values: (r: Mail) => [r.to,r.subject,r.body,r.status,r.attempts,r.createdAt,r.lastAttempt,r.firstAttempt,r.error] },
  { key: "activity", table: "lf_activity", columns: ["title","created_at"], values: (r: Workspace["activity"][number]) => [r.title,r.createdAt] },
];

async function syncEntities(tx: Connection, workspaceId: string, before: Workspace, after: Workspace, orders: Record<string, Map<string, number>>) {
  for (const spec of entities) {
    const previous = before[spec.key] as { id: string }[];
    const next = after[spec.key] as { id: string }[];
    const previousById = new Map(previous.map((row) => [row.id,row]));
    const nextIds = new Set(next.map((row) => row.id));
    for (const row of previous) if (!nextIds.has(row.id))
      await tx.query(`DELETE FROM ${spec.table} WHERE workspace_id=$1 AND id=$2`, [workspaceId,row.id]);
    const newRows = next.filter((row) => !previousById.has(row.id));
    const existingOrders = orders[spec.key] ?? new Map<string,number>();
    const highest = Math.max(-1,...existingOrders.values());
    const firstNewOrder = highest + 1;
    let newIndex = 0;
    const columns = ["workspace_id","id","sort_order",...spec.columns];
    const placeholders = columns.map((_,i) => `$${i+1}`).join(",");
    const assignments = columns.slice(2).map((column) => `${column}=excluded.${column}`).join(",");
    const upsert = `INSERT INTO ${spec.table} (${columns.join(",")}) VALUES (${placeholders}) ON CONFLICT(workspace_id,id) DO UPDATE SET ${assignments}`;
    for (const raw of next) {
      const row = raw as any;
      const old = previousById.get(row.id);
      if (old && JSON.stringify(old) === JSON.stringify(row)) continue;
      const sortOrder = old ? existingOrders.get(row.id) ?? 0 : firstNewOrder + newIndex++;
      await tx.query(upsert, [workspaceId,row.id,sortOrder,...spec.values(row).map(sqlValue)]);
    }
  }
  await syncDocumentItems(tx, workspaceId, before.documents, after.documents);
}

async function syncDocumentItems(tx: Connection, workspaceId: string, before: Document[], after: Document[]) {
  const prior = new Map<string,{ documentId: string; lineNo: number; item: Document["items"][number] }>();
  const next = new Map<string,{ documentId: string; lineNo: number; item: Document["items"][number] }>();
  for (const doc of before) doc.items.forEach((item,lineNo) => prior.set(`${doc.id}:${lineNo}`,{documentId:doc.id,lineNo,item}));
  for (const doc of after) doc.items.forEach((item,lineNo) => next.set(`${doc.id}:${lineNo}`,{documentId:doc.id,lineNo,item}));
  for (const [key,row] of prior) if (!next.has(key))
    await tx.query("DELETE FROM lf_document_items WHERE workspace_id=$1 AND document_id=$2 AND line_no=$3",[workspaceId,row.documentId,row.lineNo]);
  for (const [key,row] of next) {
    const old = prior.get(key);
    if (old && JSON.stringify(old.item) === JSON.stringify(row.item)) continue;
    await tx.query("INSERT INTO lf_document_items (workspace_id,document_id,line_no,description,quantity_milli,unit_price,tax_bps,product_id,hsn_sac) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(workspace_id,document_id,line_no) DO UPDATE SET description=excluded.description,quantity_milli=excluded.quantity_milli,unit_price=excluded.unit_price,tax_bps=excluded.tax_bps,product_id=excluded.product_id,hsn_sac=excluded.hsn_sac",[workspaceId,row.documentId,row.lineNo,row.item.description,Math.round(row.item.quantity*1000),row.item.unitPrice,row.item.taxBps,row.item.productId,row.item.hsnSac]);
  }
}

async function insertLegacyEntities(tx: Connection, workspaceId: string, state: Workspace) {
  const empty = emptyWorkspace(state.name,state.currency);
  await syncEntities(tx,workspaceId,empty,state,{});
}

async function migrateOneWorkspace(tx: Connection, id: string, data: string) {
  const current = await tx.query(
    `${isPostgres() ? "SELECT data,entities_migrated FROM lf_workspaces WHERE id=$1 FOR UPDATE" : "SELECT data,entities_migrated FROM lf_workspaces WHERE id=$1"}`,
    [id],
  );
  if (!current.rows[0] || Number(current.rows[0].entities_migrated) === 1) return;
  const state = migrateWorkspace(JSON.parse(String(current.rows[0].data ?? data)));
  await insertLegacyEntities(tx,id,state);
  await tx.query("UPDATE lf_workspaces SET data=$1,entities_migrated=1 WHERE id=$2 AND entities_migrated=0",[JSON.stringify(workspaceMetadata(state)),id]);
}

async function migrateLegacyWorkspaces(conn: Connection) {
  const { rows } = await conn.query("SELECT id,data FROM lf_workspaces WHERE entities_migrated=0");
  for (const row of rows) {
    await conn.transaction((tx) => migrateOneWorkspace(tx,String(row.id),String(row.data)));
  }
}

export async function getWorkspace(id: string): Promise<Workspace> {
  globalDb.leadflowDb ??= connect();
  const db = await globalDb.leadflowDb;
  return db.transaction(async (tx) => (await readWorkspace(tx,id)).workspace);
}

export async function updateWorkspace(id: string, mutate: (s: Workspace) => Workspace): Promise<Workspace> {
  globalDb.leadflowDb ??= connect();
  const db = await globalDb.leadflowDb;
  for (let attempt=0;attempt<12;attempt++) {
    try {
      return await db.transaction(async (tx) => {
        if (isPostgres())
          await tx.query("SELECT id FROM lf_workspaces WHERE id=$1 FOR UPDATE", [id]);
        const loaded = await readWorkspace(tx,id);
        const before = structuredClone(loaded.workspace);
        const state = mutate(loaded.workspace);
        state.revision = loaded.version + 1;
        await syncEntities(tx,id,before,state,loaded.orders);
        const result = await tx.query("UPDATE lf_workspaces SET data=$1,version=version+1 WHERE id=$2 AND version=$3",[JSON.stringify(workspaceMetadata(state)),id,loaded.version]);
        if (!result.changes) throw new Error("Workspace is busy. Please retry.");
        return state;
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt < 11 && (code === "40001" || /busy|locked/i.test(error instanceof Error ? error.message : ""))) continue;
      if (attempt === 11) throw new Error("Workspace is busy. Please retry.");
      throw error;
    }
  }
  throw new Error("Workspace is busy. Please retry.");
}

let lastAuthCleanup = 0;
let authCleanup: Promise<void> | undefined;
/** Opportunistic, process-throttled cleanup; never runs on each auth check. */
export async function cleanupExpiredAuthRecords() {
  if (Date.now() - lastAuthCleanup < 15 * 60 * 1000) return;
  if (authCleanup) return authCleanup;
  authCleanup = (async () => {
    const now = new Date().toISOString();
    await query("DELETE FROM lf_sessions WHERE expires_at<=$1", [now]);
    await query("DELETE FROM lf_auth_tokens WHERE expires_at<=$1 OR consumed_at IS NOT NULL", [now]);
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { rows } = await query("SELECT id,workspace_id FROM lf_users WHERE email_verified=0 AND created_at IS NOT NULL AND created_at<=$1", [cutoff]);
    for (const row of rows) {
      await query("DELETE FROM lf_users WHERE id=$1 AND email_verified=0", [row.id]);
      await query("DELETE FROM lf_workspaces WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM lf_users WHERE workspace_id=$1)", [row.workspace_id]);
    }
    lastAuthCleanup = Date.now();
  })().finally(() => { authCleanup = undefined; });
  return authCleanup;
}

export async function rateLimit(key: string, limit = 10, windowMs = 15 * 60 * 1000) {
  const now = new Date().toISOString();
  const reset = new Date(Date.now() + windowMs).toISOString();
  const { rows } = await query(
    "INSERT INTO lf_limits (key,count,reset_at) VALUES ($1,1,$2) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN lf_limits.reset_at<$3 THEN 1 ELSE lf_limits.count+1 END,reset_at=CASE WHEN lf_limits.reset_at<$3 THEN $2 ELSE lf_limits.reset_at END RETURNING count",
    [key, reset, now],
  );
  if (Number(rows[0].count) > limit) throw new Error("Too many attempts. Please try again later.");
}
