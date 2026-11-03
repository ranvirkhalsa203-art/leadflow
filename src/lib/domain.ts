import { z } from "zod";

export const leadStages = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
] as const;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => new Date(v).toISOString().slice(0, 10) === v,
    "Choose a valid date",
  );
const money = z.number().int().min(0).max(100_000_000_00);
const text = z.string().trim().min(1).max(200);
const id = z.string().min(1).max(100);
const itemSchema = z.object({
  description: text,
  quantity: z
    .number()
    .min(0.001)
    .max(10000)
    .refine(
      (v) => Number.isInteger(v * 1000),
      "Use up to three decimal places",
    ),
  unitPrice: money,
  taxBps: z.number().int().min(0).max(10000).optional(),
  productId: id.optional(),
  hsnSac: z
    .string()
    .trim()
    .max(8)
    .regex(/^\d{0,8}$/)
    .optional(),
});
export type LineItem = z.infer<typeof itemSchema>;
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lead.create"),
    name: text,
    company: z.string().trim().max(200),
    email: z.email().max(254),
    value: money,
    source: text,
    state: z.string().trim().max(100).default(""),
  }),
  z.object({ type: z.literal("lead.update"), id, status: z.enum(leadStages) }),
  z.object({
    type: z.literal("lead.edit"),
    id,
    name: text,
    company: z.string().trim().max(200),
    email: z.email().max(254),
    value: money,
    source: text,
    state: z.string().trim().max(100).default(""),
  }),
  z.object({ type: z.literal("lead.delete"), id }),
  z.object({
    type: z.literal("product.create"),
    name: text,
    description: z.string().max(1000),
    hsnSac: z
      .string()
      .trim()
      .max(8)
      .regex(/^\d{0,8}$/)
      .default(""),
    unitPrice: money,
    taxBps: z.number().int().min(0).max(10000),
    trackInventory: z.boolean(),
    stockOnHandMilli: z.number().int().min(0).max(1000000000),
    lowStockAtMilli: z.number().int().min(0).max(1000000000),
  }),
  z.object({
    type: z.literal("product.update"),
    id,
    name: text,
    description: z.string().max(1000),
    hsnSac: z
      .string()
      .trim()
      .max(8)
      .regex(/^\d{0,8}$/)
      .default(""),
    unitPrice: money,
    taxBps: z.number().int().min(0).max(10000),
    active: z.boolean(),
    trackInventory: z.boolean(),
    stockOnHandMilli: z.number().int().min(0).max(1000000000),
    lowStockAtMilli: z.number().int().min(0).max(1000000000),
  }),
  z.object({
    type: z.literal("followup.create"),
    leadId: id,
    title: text,
    dueDate: date,
  }),
  z.object({ type: z.literal("followup.toggle"), id }),
  z.object({
    type: z.literal("document.create"),
    kind: z.enum(["quote", "invoice", "credit"]),
    leadId: id,
    relatedDocumentId: id.optional(),
    dueDate: date,
    items: z.array(itemSchema).min(1).max(50),
    taxBps: z.number().int().min(0).max(10000),
    notes: z.string().max(2000),
  }),
  z.object({ type: z.literal("document.convert"), id }),
  z.object({ type: z.literal("document.issue"), id }),
  z.object({ type: z.literal("document.accept"), id }),
  z.object({ type: z.literal("document.void"), id }),
  z.object({
    type: z.literal("payment.create"),
    documentId: id,
    amount: money.positive(),
    method: z.enum(["Bank transfer", "UPI", "Card", "Cash", "Other"]),
    reference: z.string().max(200),
    idempotencyKey: z.string().min(8).max(100),
  }),
  z.object({
    type: z.literal("feedback.create"),
    category: z.enum(["Feature request", "Bug report", "General feedback"]),
    message: z.string().trim().min(5).max(4000),
  }),
  z.object({
    type: z.literal("email.queue"),
    leadId: id,
    subject: text,
    body: z.string().trim().min(1).max(10000),
  }),
  z.object({
    type: z.literal("settings.update"),
    name: text,
    currency: z.enum(["INR", "USD", "EUR", "GBP", "CAD", "AUD"]),
    business: z.object({
      legalName: z.string().trim().max(200),
      address: z.string().trim().max(1000),
      email: z.union([z.literal(""), z.email().max(254)]),
      phone: z.string().trim().max(40),
      gstin: z
        .string()
        .trim()
        .max(15)
        .regex(
          /^(?:|[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])$/i,
          "Enter a valid 15-character GSTIN",
        ),
      state: z.string().trim().max(100),
      paymentTerms: z.string().trim().max(500),
      bankDetails: z.string().trim().max(1000),
    }),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export type Lead = {
  id: string;
  name: string;
  company: string;
  email: string;
  value: number;
  source: string;
  state: string;
  status: (typeof leadStages)[number];
  createdAt: string;
};
export type Document = {
  id: string;
  number: string;
  kind: "quote" | "invoice" | "credit";
  leadId: string;
  dueDate: string;
  items: LineItem[];
  taxBps: number;
  subtotal: number;
  tax: number;
  taxSplit?: {
    supply: "intrastate" | "interstate" | "unspecified";
    cgst: number;
    sgst: number;
    igst: number;
  };
  total: number;
  notes: string;
  status:
    "draft" | "issued" | "accepted" | "partial" | "paid" | "credited" | "void";
  createdAt: string;
  quoteId?: string;
  relatedDocumentId?: string;
};
export type Payment = {
  id: string;
  documentId: string;
  amount: number;
  method: string;
  reference: string;
  idempotencyKey: string;
  createdAt: string;
};
export type Mail = {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  createdAt: string;
  lastAttempt?: string;
  firstAttempt?: string;
  error?: string;
};
export type Workspace = {
  schemaVersion: number;
  revision: number;
  name: string;
  currency: string;
  isDemo: boolean;
  leads: Lead[];
  products: Product[];
  inventoryMovements: InventoryMovement[];
  business: BusinessProfile;
  followups: {
    id: string;
    leadId: string;
    title: string;
    dueDate: string;
    done: boolean;
  }[];
  documents: Document[];
  payments: Payment[];
  feedback: {
    id: string;
    category: string;
    message: string;
    createdAt: string;
  }[];
  outbox: Mail[];
  subscription: {
    plan: "starter";
    status: "free";
    customerId: null;
    subscriptionId: null;
  };
  activity: { id: string; title: string; createdAt: string }[];
};
export type Product = {
  id: string;
  name: string;
  description: string;
  hsnSac: string;
  unitPrice: number;
  taxBps: number;
  active: boolean;
  trackInventory: boolean;
  stockOnHandMilli: number;
  lowStockAtMilli: number;
  createdAt: string;
};
export type InventoryMovement = {
  id: string;
  productId: string;
  documentId?: string;
  type: "opening" | "sale" | "sale_void" | "adjustment";
  quantityMilli: number;
  stockAfterMilli: number;
  note: string;
  createdAt: string;
};
export type BusinessProfile = {
  legalName: string;
  address: string;
  email: string;
  phone: string;
  gstin: string;
  state: string;
  paymentTerms: string;
  bankDetails: string;
};
export function emptyWorkspace(name: string, currency: string): Workspace {
  return {
    schemaVersion: 4,
    revision: 0,
    name,
    currency,
    isDemo: false,
    leads: [],
    products: [],
    inventoryMovements: [],
    business: {
      legalName: "",
      address: "",
      email: "",
      phone: "",
      gstin: "",
      state: "",
      paymentTerms: "",
      bankDetails: "",
    },
    followups: [],
    documents: [],
    payments: [],
    feedback: [],
    outbox: [],
    subscription: {
      plan: "starter",
      status: "free",
      customerId: null,
      subscriptionId: null,
    },
    activity: [],
  };
}
/** Central migration for workspace JSON, including v1 decimal inventory. */
export function migrateWorkspace(raw: unknown): Workspace {
  const stored = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const defaults = emptyWorkspace(
    String(stored.name ?? "My workspace"),
    String(stored.currency ?? "INR"),
  );
  const products = Array.isArray(stored.products) ? stored.products : [];
  const migratedProducts = products.map((entry) => {
    const p = (entry && typeof entry === "object" ? entry : {}) as Record<
      string,
      unknown
    >;
    const { stockOnHand, lowStockAt, ...rest } = p;
    return {
      ...rest,
      stockOnHandMilli: Number.isInteger(p.stockOnHandMilli)
        ? p.stockOnHandMilli
        : Math.round(Number(stockOnHand ?? 0) * 1000),
      lowStockAtMilli: Number.isInteger(p.lowStockAtMilli)
        ? p.lowStockAtMilli
        : Math.round(Number(lowStockAt ?? 0) * 1000),
      hsnSac: typeof p.hsnSac === "string" ? p.hsnSac : "",
    } as Product;
  });
  const movements = Array.isArray(stored.inventoryMovements)
    ? (stored.inventoryMovements as InventoryMovement[])
    : migratedProducts
        .filter(
          (product) => product.trackInventory && product.stockOnHandMilli > 0,
        )
        .map((product) => ({
          id: `migration-${product.id}`,
          productId: product.id,
          type: "opening" as const,
          quantityMilli: product.stockOnHandMilli,
          stockAfterMilli: product.stockOnHandMilli,
          note: "Opening balance migrated from earlier workspace data",
          createdAt: String(product.createdAt ?? new Date(0).toISOString()),
        }));
  return {
    ...defaults,
    ...stored,
    products: migratedProducts,
    inventoryMovements: movements,
    business: {
      ...defaults.business,
      ...(stored.business && typeof stored.business === "object"
        ? stored.business
        : {}),
    },
    followups: Array.isArray(stored.followups)
      ? (stored.followups as Workspace["followups"])
      : [],
    documents: Array.isArray(stored.documents)
      ? (stored.documents as Document[])
      : [],
    payments: Array.isArray(stored.payments)
      ? (stored.payments as Payment[])
      : [],
    feedback: Array.isArray(stored.feedback)
      ? (stored.feedback as Workspace["feedback"])
      : [],
    outbox: Array.isArray(stored.outbox) ? (stored.outbox as Mail[]) : [],
    activity: Array.isArray(stored.activity)
      ? (stored.activity as Workspace["activity"])
      : [],
    leads: (Array.isArray(stored.leads) ? stored.leads : []).map((entry) => {
      const lead = entry as Lead;
      return {
        ...lead,
        state: typeof lead.state === "string" ? lead.state : "",
      };
    }),
    schemaVersion: 4,
  };
}
export function totals(items: LineItem[], taxBps: number) {
  z.array(itemSchema).min(1).max(50).parse(items);
  z.number().int().min(0).max(10000).parse(taxBps);
  const subtotal = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice),
    0,
  );
  const tax = items.reduce(
    (sum, item) =>
      sum +
      Math.round(
        (Math.round(item.quantity * item.unitPrice) * (item.taxBps ?? taxBps)) /
          10000,
      ),
    0,
  );
  const total = subtotal + tax;
  if (!Number.isSafeInteger(total) || total > 100_000_000_00)
    throw new Error("Document total is too large");
  if (total <= 0) throw new Error("Document total must be positive");
  return { subtotal, tax, total };
}
export function paidAmount(s: Workspace, id: string) {
  return s.payments
    .filter((p) => p.documentId === id)
    .reduce((sum, p) => sum + p.amount, 0);
}
export function creditedAmount(s: Workspace, id: string) {
  return s.documents
    .filter(
      (d) =>
        d.kind === "credit" &&
        d.relatedDocumentId === id &&
        !["draft", "void"].includes(d.status),
    )
    .reduce((sum, d) => sum + d.total, 0);
}
export function outstandingAmount(s: Workspace, id: string) {
  return Math.max(
    0,
    (s.documents.find((d) => d.id === id)?.total ?? 0) -
      paidAmount(s, id) -
      creditedAmount(s, id),
  );
}
function find<T extends { id: string }>(rows: T[], id: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error("Record not found in this workspace");
  return row;
}
export function applyCommand(s: Workspace, raw: unknown): Workspace {
  const c = commandSchema.parse(raw);
  const now = new Date().toISOString();
  const uid = () => crypto.randomUUID();
  let title = "";
  switch (c.type) {
    case "lead.create":
      s.leads.unshift({
        id: uid(),
        name: c.name,
        company: c.company,
        email: c.email,
        value: c.value,
        source: c.source,
        state: c.state,
        status: "new",
        createdAt: now,
      });
      if (!s.isDemo) {
        const business = s.business.legalName || s.name;
        const firstName = c.name.split(/\s+/)[0];
        s.outbox.unshift({
          id: uid(), to: c.email, subject: `A quick hello from ${business}`,
          body: `Hi ${firstName},\n\nThanks for connecting with ${business}. We’ve saved your contact details so we can follow up with you personally.\n\nIs there anything you’d like help with, or a time that works best to get in touch? Just reply and let us know.\n\nThanks,\nThe ${business} team`,
          status: "queued", attempts: 0, createdAt: now,
        });
      }
      title = `Added ${c.name}`;
      break;
    case "lead.update": {
      const l = find(s.leads, c.id);
      l.status = c.status;
      title = `${l.name} moved to ${c.status}`;
      break;
    }
    case "lead.edit": {
      const l = find(s.leads, c.id);
      Object.assign(l, {
        name: c.name,
        company: c.company,
        email: c.email,
        value: c.value,
        source: c.source,
        state: c.state,
      });
      title = `Updated ${l.name}`;
      break;
    }
    case "lead.delete": {
      const l = find(s.leads, c.id);
      if (
        s.documents.some((d) => d.leadId === l.id) ||
        s.followups.some((f) => f.leadId === l.id) ||
        s.outbox.some((m) => m.to === l.email)
      )
        throw new Error(
          "This contact has business history and cannot be deleted",
        );
      s.leads = s.leads.filter((x) => x.id !== l.id);
      title = `Deleted ${l.name}`;
      break;
    }
    case "product.create": {
      const product: Product = {
        id: uid(),
        name: c.name,
        description: c.description,
        unitPrice: c.unitPrice,
        taxBps: c.taxBps,
        active: true,
        trackInventory: c.trackInventory,
        hsnSac: c.hsnSac,
        stockOnHandMilli: c.trackInventory ? c.stockOnHandMilli : 0,
        lowStockAtMilli: c.trackInventory ? c.lowStockAtMilli : 0,
        createdAt: now,
      };
      s.products.unshift(product);
      if (product.trackInventory && product.stockOnHandMilli > 0)
        s.inventoryMovements.unshift({
          id: uid(),
          productId: product.id,
          type: "opening",
          quantityMilli: product.stockOnHandMilli,
          stockAfterMilli: product.stockOnHandMilli,
          note: "Opening stock",
          createdAt: now,
        });
      title = `Added product ${c.name}`;
      break;
    }
    case "product.update": {
      const p = s.products.find((x) => x.id === c.id);
      if (!p) throw new Error("Product not found in this workspace");
      const previousStock = p.stockOnHandMilli;
      Object.assign(p, {
        name: c.name,
        description: c.description,
        unitPrice: c.unitPrice,
        taxBps: c.taxBps,
        hsnSac: c.hsnSac,
        active: c.active,
        trackInventory: c.trackInventory,
        stockOnHandMilli: c.trackInventory ? c.stockOnHandMilli : 0,
        lowStockAtMilli: c.trackInventory ? c.lowStockAtMilli : 0,
      });
      if (c.stockOnHandMilli !== previousStock)
        s.inventoryMovements.unshift({
          id: uid(),
          productId: p.id,
          type: "adjustment",
          quantityMilli: c.stockOnHandMilli - previousStock,
          stockAfterMilli: c.stockOnHandMilli,
          note: "Manual stock adjustment",
          createdAt: now,
        });
      title = `Updated product ${p.name}`;
      break;
    }
    case "followup.create":
      find(s.leads, c.leadId);
      s.followups.push({
        id: uid(),
        leadId: c.leadId,
        title: c.title,
        dueDate: c.dueDate,
        done: false,
      });
      title = `Scheduled ${c.title}`;
      break;
    case "followup.toggle": {
      const f = find(s.followups, c.id);
      f.done = !f.done;
      title = `${f.done ? "Completed" : "Reopened"} ${f.title}`;
      break;
    }
    case "document.create": {
      const lead = find(s.leads, c.leadId);
      const items = c.items.map((item) => {
        if (!item.productId) return item;
        const product = s.products.find(
          (p) => p.id === item.productId && p.active,
        );
        if (!product)
          throw new Error("Choose an active product from this workspace");
        return {
          ...item,
          description: product.name,
          unitPrice: product.unitPrice,
          taxBps: product.taxBps,
          hsnSac: product.hsnSac,
        };
      });
      if (c.kind === "credit") {
        const original = c.relatedDocumentId
          ? find(s.documents, c.relatedDocumentId)
          : null;
        if (
          !original ||
          original.kind !== "invoice" ||
          original.leadId !== lead.id ||
          ["draft", "void"].includes(original.status)
        )
          throw new Error("Choose an issued invoice for this credit note");
        const { total } = totals(items, c.taxBps);
        if (total > outstandingAmount(s, original.id))
          throw new Error("Credit note exceeds the invoice balance due");
      }
      const n = s.documents.filter((d) => d.kind === c.kind).length + 1;
      const supply =
        s.currency === "INR" && s.business.state && lead.state
          ? s.business.state.trim().toLocaleLowerCase() ===
            lead.state.trim().toLocaleLowerCase()
            ? ("intrastate" as const)
            : ("interstate" as const)
          : ("unspecified" as const);
      const taxSplit = { supply, cgst: 0, sgst: 0, igst: 0 };
      if (supply !== "unspecified") {
        for (const item of items) {
          const lineTax = Math.round(
            (Math.round(item.quantity * item.unitPrice) *
              (item.taxBps ?? c.taxBps)) /
              10000,
          );
          if (supply === "intrastate") {
            taxSplit.cgst += Math.floor(lineTax / 2);
            taxSplit.sgst += lineTax - Math.floor(lineTax / 2);
          } else taxSplit.igst += lineTax;
        }
      }
      s.documents.unshift({
        id: uid(),
        number: `${c.kind === "quote" ? "QUO" : c.kind === "credit" ? "CRN" : "INV"}-${String(n).padStart(4, "0")}`,
        kind: c.kind,
        relatedDocumentId: c.relatedDocumentId,
        leadId: c.leadId,
        dueDate: c.dueDate,
        items,
        taxBps: c.taxBps,
        ...totals(items, c.taxBps),
        taxSplit,
        notes: c.notes,
        status: "draft",
        createdAt: now,
      });
      title = `Created ${s.documents[0].number}`;
      break;
    }
    case "document.issue": {
      const d = find(s.documents, c.id);
      if (d.status !== "draft") throw new Error("Only a draft can be issued");
      if (d.kind === "credit") {
        const original = find(s.documents, d.relatedDocumentId || "");
        const alreadyCredited = creditedAmount(s, original.id);
        if (
          d.total + alreadyCredited >
          original.total - paidAmount(s, original.id)
        )
          throw new Error("Credit note exceeds the invoice balance due");
        d.status = "issued";
        if (outstandingAmount(s, original.id) === 0)
          original.status = "credited";
        title = `Issued ${d.number}`;
        break;
      }
      if (d.kind === "invoice") {
        const quantities = new Map<string, number>();
        for (const item of d.items) {
          if (item.productId)
            quantities.set(
              item.productId,
              (quantities.get(item.productId) ?? 0) +
                Math.round(item.quantity * 1000),
            );
        }
        for (const [productId, quantity] of quantities) {
          const product = s.products.find((p) => p.id === productId);
          if (product?.trackInventory && product.stockOnHandMilli < quantity)
            throw new Error(`Not enough stock for ${product.name}`);
        }
        for (const [productId, quantity] of quantities) {
          const product = s.products.find((p) => p.id === productId);
          if (product?.trackInventory) {
            product.stockOnHandMilli -= quantity;
            s.inventoryMovements.unshift({
              id: uid(),
              productId,
              documentId: d.id,
              type: "sale",
              quantityMilli: -quantity,
              stockAfterMilli: product.stockOnHandMilli,
              note: `Issued ${d.number}`,
              createdAt: now,
            });
          }
        }
      }
      d.status = "issued";
      title = `Issued ${d.number}`;
      break;
    }
    case "document.accept": {
      const d = find(s.documents, c.id);
      if (d.kind !== "quote" || d.status !== "issued")
        throw new Error("Only an issued quotation can be accepted");
      d.status = "accepted";
      title = `Accepted ${d.number}`;
      break;
    }
    case "document.void": {
      const d = find(s.documents, c.id);
      const wasIssued = d.status !== "draft";
      if (
        d.status === "paid" ||
        d.status === "partial" ||
        s.payments.some((p) => p.documentId === d.id)
      )
        throw new Error("A document with payments cannot be voided");
      if (
        d.kind === "invoice" &&
        s.documents.some(
          (x) =>
            x.kind === "credit" &&
            x.relatedDocumentId === d.id &&
            x.status !== "void",
        )
      )
        throw new Error(
          "Void or remove linked credit notes before voiding the invoice",
        );
      if (d.status === "void") throw new Error("This document is already void");
      d.status = "void";
      if (d.kind === "credit") {
        const original = find(s.documents, d.relatedDocumentId || "");
        if (original.status === "credited") {
          const paid = paidAmount(s, original.id);
          original.status =
            paid >= original.total ? "paid" : paid > 0 ? "partial" : "issued";
        }
      }
      if (wasIssued && d.kind === "invoice")
        for (const item of d.items) {
          const product = item.productId
            ? s.products.find((p) => p.id === item.productId)
            : undefined;
          if (product?.trackInventory) {
            const quantityMilli = Math.round(item.quantity * 1000);
            product.stockOnHandMilli += quantityMilli;
            s.inventoryMovements.unshift({
              id: uid(),
              productId: product.id,
              documentId: d.id,
              type: "sale_void",
              quantityMilli,
              stockAfterMilli: product.stockOnHandMilli,
              note: `Voided ${d.number}`,
              createdAt: now,
            });
          }
        }
      title = `Voided ${d.number}`;
      break;
    }
    case "document.convert": {
      const q = find(s.documents, c.id);
      if (q.kind !== "quote") throw new Error("Choose a quotation");
      const activeInvoice = s.documents.find(
        (d) => d.quoteId === q.id && d.status !== "void",
      );
      if (activeInvoice) return s;
      if (q.status !== "accepted")
        throw new Error("Accept the issued quotation before converting it");
      const n = s.documents.filter((d) => d.kind === "invoice").length + 1;
      s.documents.unshift({
        ...structuredClone(q),
        id: uid(),
        number: `INV-${String(n).padStart(4, "0")}`,
        kind: "invoice",
        quoteId: q.id,
        status: "draft",
        createdAt: now,
      });
      title = `Converted ${q.number} to invoice`;
      break;
    }
    case "payment.create": {
      const previous = s.payments.find(
        (p) => p.idempotencyKey === c.idempotencyKey,
      );
      if (previous) {
        if (
          previous.documentId !== c.documentId ||
          previous.amount !== c.amount ||
          previous.method !== c.method ||
          previous.reference !== c.reference
        )
          throw new Error("Payment reference was already used");
        return s;
      }
      const d = find(s.documents, c.documentId);
      if (
        d.kind !== "invoice" ||
        ["draft", "void", "credited"].includes(d.status)
      )
        throw new Error("Issue an invoice before recording payment");
      const outstanding = outstandingAmount(s, d.id);
      if (c.amount > outstanding)
        throw new Error("Payment exceeds the outstanding balance");
      s.payments.unshift({
        id: uid(),
        documentId: d.id,
        amount: c.amount,
        method: c.method,
        reference: c.reference,
        idempotencyKey: c.idempotencyKey,
        createdAt: now,
      });
      d.status = c.amount === outstanding ? "paid" : "partial";
      title = `Recorded payment for ${d.number}`;
      break;
    }
    case "feedback.create":
      s.feedback.unshift({
        id: uid(),
        category: c.category,
        message: c.message,
        createdAt: now,
      });
      title = "Feedback saved";
      break;
    case "email.queue": {
      const l = find(s.leads, c.leadId);
      s.outbox.unshift({
        id: uid(),
        to: l.email,
        subject: c.subject,
        body: c.body,
        status: "queued",
        attempts: 0,
        createdAt: now,
      });
      title = `Queued email to ${l.name}`;
      break;
    }
    case "settings.update":
      if (
        c.currency !== s.currency &&
        (s.leads.length || s.documents.length || s.payments.length)
      )
        throw new Error(
          "Currency cannot change after financial records are created",
        );
      s.name = c.name;
      s.currency = c.currency;
      s.business = c.business;
      title = "Updated workspace settings";
      break;
  }
  s.activity.unshift({ id: uid(), title, createdAt: now });
  s.activity = s.activity.slice(0, 100);
  return s;
}
export function formatMoney(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value / 100);
}
