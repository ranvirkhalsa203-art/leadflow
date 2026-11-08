import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyWorkspace,
  applyCommand,
  totals,
  outstandingAmount,
  migrateWorkspace,
} from "../src/lib/domain";

test("money rounds tax once, uses minor units, rejects unsafe and negative inputs", () => {
  assert.deepEqual(
    totals([{ description: "Design", quantity: 3, unitPrice: 1999 }], 1800),
    { subtotal: 5997, tax: 1079, total: 7076 },
  );
  assert.throws(() =>
    totals([{ description: "Bad", quantity: 1, unitPrice: -1 }], 0),
  );
  assert.deepEqual(
    totals([{ description: "Rope", quantity: 1.25, unitPrice: 1000 }], 1800),
    { subtotal: 1250, tax: 225, total: 1475 },
  );
  assert.throws(
    () => totals([{ description: "Bad", quantity: 1.0001, unitPrice: 10 }], 0),
    /decimal/,
  );
  assert.throws(() =>
    totals(
      [
        {
          description: "Bad",
          quantity: 1000000,
          unitPrice: Number.MAX_SAFE_INTEGER,
        },
      ],
      0,
    ),
  );
});

test("customer to quotation to invoice to partial payment, with replay protection", () => {
  const s = emptyWorkspace("Studio", "INR");
  applyCommand(s, {
    type: "lead.create",
    name: "Asha",
    company: "Orbit",
    email: "asha@example.com",
    value: 50000,
    source: "Referral",
  });
  const leadId = s.leads[0].id;
  applyCommand(s, {
    type: "document.create",
    kind: "quote",
    leadId,
    dueDate: "2026-12-01",
    items: [{ description: "Brand system", quantity: 2, unitPrice: 25000 }],
    taxBps: 1800,
    notes: "",
  });
  const q = s.documents[0];
  assert.equal(q.total, 59000);
  assert.throws(
    () => applyCommand(s, { type: "document.convert", id: q.id }),
    /accept/i,
  );
  applyCommand(s, { type: "document.issue", id: q.id });
  applyCommand(s, { type: "document.accept", id: q.id });
  applyCommand(s, { type: "document.convert", id: q.id });
  applyCommand(s, { type: "document.convert", id: q.id });
  assert.equal(s.documents.length, 2);
  const inv = s.documents.find((x) => x.kind === "invoice")!;
  applyCommand(s, { type: "document.issue", id: inv.id });
  applyCommand(s, {
    type: "payment.create",
    documentId: inv.id,
    amount: 20000,
    method: "Bank transfer",
    reference: "first",
    idempotencyKey: "payment-test-0001",
  });
  applyCommand(s, {
    type: "payment.create",
    documentId: inv.id,
    amount: 20000,
    method: "Bank transfer",
    reference: "first",
    idempotencyKey: "payment-test-0001",
  });
  assert.equal(s.payments.length, 1);
  assert.equal(inv.status, "partial");
  assert.throws(
    () =>
      applyCommand(s, {
        type: "payment.create",
        documentId: inv.id,
        amount: 40000,
        method: "Cash",
        reference: "",
        idempotencyKey: "payment-test-0002",
      }),
    /outstanding/i,
  );
  applyCommand(s, {
    type: "payment.create",
    documentId: inv.id,
    amount: 39000,
    method: "Cash",
    reference: "",
    idempotencyKey: "payment-test-0003",
  });
  assert.equal(inv.status, "paid");
});

test("rejects foreign records, draft payments and invalid transitions", () => {
  const s = emptyWorkspace("Empty", "USD");
  assert.throws(
    () =>
      applyCommand(s, { type: "lead.update", id: "foreign", status: "won" }),
    /not found/i,
  );
  assert.throws(() =>
    applyCommand(s, {
      type: "followup.create",
      leadId: "foreign",
      title: "Call",
      dueDate: "2026-12-01",
    }),
  );
  applyCommand(s, {
    type: "lead.create",
    name: "A",
    company: "B",
    email: "a@b.co",
    value: 100,
    source: "Website",
  });
  applyCommand(s, {
    type: "document.create",
    kind: "invoice",
    leadId: s.leads[0].id,
    dueDate: "2026-12-01",
    items: [{ description: "Work", quantity: 1, unitPrice: 100 }],
    taxBps: 0,
    notes: "",
  });
  assert.throws(
    () =>
      applyCommand(s, {
        type: "payment.create",
        documentId: s.documents[0].id,
        amount: 100,
        method: "Cash",
        reference: "",
        idempotencyKey: "draft-payment-01",
      }),
    /issue/i,
  );
  assert.throws(
    () =>
      applyCommand(s, {
        type: "settings.update",
        name: "Other",
        currency: "EUR",
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
      }),
    /currency/i,
  );
});

test("follow-ups complete, feedback persists, email queues without claiming delivery", () => {
  const s = emptyWorkspace("Studio", "INR");
  applyCommand(s, {
    type: "lead.create",
    name: "Asha",
    company: "Orbit",
    email: "asha@example.com",
    value: 500,
    source: "Referral",
  });
  applyCommand(s, {
    type: "followup.create",
    leadId: s.leads[0].id,
    title: "Discuss scope",
    dueDate: "2026-12-01",
  });
  applyCommand(s, { type: "followup.toggle", id: s.followups[0].id });
  assert.equal(s.followups[0].done, true);
  applyCommand(s, {
    type: "feedback.create",
    category: "Feature request",
    message: "Please add project timelines",
  });
  assert.equal(s.feedback.length, 1);
  applyCommand(s, {
    type: "email.queue",
    leadId: s.leads[0].id,
    subject: "Next steps",
    body: "Can we discuss the proposal?",
  });
  assert.equal(s.outbox[0].status, "queued");
  assert.equal(s.outbox[0].to, "asha@example.com");
});

test("product catalog, credit notes, and voiding preserve invoice balances", () => {
  const s = emptyWorkspace("Studio", "INR");
  applyCommand(s, {
    type: "lead.create",
    name: "Asha",
    company: "Orbit",
    email: "asha@example.com",
    value: 10000,
    source: "Website",
  });
  const leadId = s.leads[0].id;
  applyCommand(s, {
    type: "product.create",
    name: "Consulting",
    description: "Hourly service",
    hsnSac: "998314",
    unitPrice: 10000,
    taxBps: 1800,
    trackInventory: true,
    stockOnHandMilli: 3000,
    lowStockAtMilli: 1000,
  });
  assert.equal(s.products[0].active, true);
  applyCommand(s, {
    type: "document.create",
    kind: "invoice",
    leadId,
    dueDate: "2026-12-01",
    items: [
      {
        description: "Consulting",
        quantity: 1,
        unitPrice: 10000,
        taxBps: 1800,
        productId: s.products[0].id,
      },
    ],
    taxBps: 0,
    notes: "",
  });
  const invoice = s.documents[0];
  assert.equal(invoice.total, 11800);
  assert.equal(invoice.items[0].hsnSac, "998314");
  applyCommand(s, { type: "document.issue", id: invoice.id });
  assert.equal(s.products[0].stockOnHandMilli, 2000);
  assert.equal(s.inventoryMovements.length, 2);
  applyCommand(s, {
    type: "document.create",
    kind: "credit",
    leadId,
    relatedDocumentId: invoice.id,
    dueDate: "2026-12-01",
    items: [
      {
        description: "Service adjustment",
        quantity: 1,
        unitPrice: 2000,
        taxBps: 1800,
      },
    ],
    taxBps: 0,
    notes: "",
  });
  const credit = s.documents[0];
  assert.equal(credit.total, 2360);
  applyCommand(s, { type: "document.issue", id: credit.id });
  assert.equal(outstandingAmount(s, invoice.id), 9440);
  assert.equal(invoice.status, "issued");
  assert.throws(
    () => applyCommand(s, { type: "document.void", id: invoice.id }),
    /credit/i,
  );
  applyCommand(s, { type: "document.void", id: credit.id });
  assert.equal(outstandingAmount(s, invoice.id), 11800);
  assert.equal(invoice.status, "issued");
  applyCommand(s, { type: "document.void", id: invoice.id });
  assert.equal(s.products[0].stockOnHandMilli, 3000);
  assert.equal(s.inventoryMovements.length, 3);
});

test("three sales of 0.2 items consume 0.6 inventory without float drift", () => {
  const s = emptyWorkspace("Studio", "INR");
  applyCommand(s, {
    type: "lead.create",
    name: "Asha",
    company: "Orbit",
    email: "asha@example.com",
    value: 10000,
    source: "Website",
  });
  const leadId = s.leads[0].id;
  applyCommand(s, {
    type: "product.create",
    name: "Fabric",
    description: "By metre",
    unitPrice: 1000,
    taxBps: 0,
    trackInventory: true,
    stockOnHandMilli: 600,
    lowStockAtMilli: 200,
  });
  const productId = s.products[0].id;
  for (let i = 0; i < 3; i++) {
    applyCommand(s, {
      type: "document.create",
      kind: "invoice",
      leadId,
      dueDate: "2026-12-01",
      items: [
        { description: "Fabric", quantity: 0.2, unitPrice: 1000, productId },
      ],
      taxBps: 0,
      notes: "",
    });
    applyCommand(s, { type: "document.issue", id: s.documents[0].id });
  }
  assert.equal(s.products[0].stockOnHandMilli, 0);
  assert.deepEqual(
    s.inventoryMovements
      .filter((m) => m.type === "sale")
      .map((m) => m.quantityMilli),
    [-200, -200, -200],
  );
});

test("a fully credited invoice is marked credited and reopens when its credit is voided", () => {
  const s = emptyWorkspace("Studio", "INR");
  applyCommand(s, {
    type: "lead.create",
    name: "Asha",
    company: "Orbit",
    email: "asha@example.com",
    value: 10000,
    source: "Website",
  });
  applyCommand(s, {
    type: "document.create",
    kind: "invoice",
    leadId: s.leads[0].id,
    dueDate: "2026-12-01",
    items: [{ description: "Work", quantity: 1, unitPrice: 10000 }],
    taxBps: 0,
    notes: "",
  });
  const invoice = s.documents[0];
  applyCommand(s, { type: "document.issue", id: invoice.id });
  applyCommand(s, {
    type: "document.create",
    kind: "credit",
    leadId: s.leads[0].id,
    relatedDocumentId: invoice.id,
    dueDate: "2026-12-01",
    items: [{ description: "Full reversal", quantity: 1, unitPrice: 10000 }],
    taxBps: 0,
    notes: "",
  });
  const credit = s.documents[0];
  applyCommand(s, { type: "document.issue", id: credit.id });
  assert.equal(invoice.status, "credited");
  assert.equal(outstandingAmount(s, invoice.id), 0);
  applyCommand(s, { type: "document.void", id: credit.id });
  assert.equal(invoice.status, "issued");
  assert.equal(outstandingAmount(s, invoice.id), 10000);
});

test("a voided converted invoice can be recreated from its accepted quote", () => {
  const s = emptyWorkspace("Studio", "INR");
  applyCommand(s, {
    type: "lead.create",
    name: "Asha",
    company: "Orbit",
    email: "asha@example.com",
    value: 1000,
    source: "Website",
  });
  applyCommand(s, {
    type: "document.create",
    kind: "quote",
    leadId: s.leads[0].id,
    dueDate: "2026-12-01",
    items: [{ description: "Work", quantity: 1, unitPrice: 1000 }],
    taxBps: 0,
    notes: "",
  });
  const quote = s.documents[0];
  applyCommand(s, { type: "document.issue", id: quote.id });
  applyCommand(s, { type: "document.accept", id: quote.id });
  applyCommand(s, { type: "document.convert", id: quote.id });
  const firstInvoice = s.documents.find((d) => d.kind === "invoice")!;
  applyCommand(s, { type: "document.void", id: firstInvoice.id });
  applyCommand(s, { type: "document.convert", id: quote.id });
  assert.equal(
    s.documents.filter((d) => d.kind === "invoice" && d.status !== "void")
      .length,
    1,
  );
  assert.equal(
    s.documents.find((d) => d.kind === "invoice" && d.status !== "void")
      ?.number,
    "INV-0002",
  );
});

test("workspace migration converts legacy decimal stock to exact milli-units", () => {
  const migrated = migrateWorkspace({
    name: "Legacy",
    currency: "INR",
    products: [
      {
        id: "p1",
        name: "Fabric",
        description: "",
        unitPrice: 100,
        taxBps: 0,
        active: true,
        trackInventory: true,
        stockOnHand: 0.6,
        lowStockAt: 0.2,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.products[0].stockOnHandMilli, 600);
  assert.equal(migrated.products[0].lowStockAtMilli, 200);
  assert.equal(migrated.inventoryMovements[0].quantityMilli, 600);
});

test("manual inventory changes are added to the movement ledger", () => {
  const s = emptyWorkspace("Studio", "INR");
  applyCommand(s, {
    type: "product.create",
    name: "Fabric",
    description: "",
    unitPrice: 100,
    taxBps: 0,
    trackInventory: true,
    stockOnHandMilli: 1000,
    lowStockAtMilli: 100,
  });
  const product = s.products[0];
  applyCommand(s, {
    type: "product.update",
    id: product.id,
    name: product.name,
    description: product.description,
    unitPrice: product.unitPrice,
    taxBps: product.taxBps,
    active: true,
    trackInventory: true,
    stockOnHandMilli: 700,
    lowStockAtMilli: 100,
  });
  assert.deepEqual(
    s.inventoryMovements.map((m) => [
      m.type,
      m.quantityMilli,
      m.stockAfterMilli,
    ]),
    [
      ["adjustment", -300, 700],
      ["opening", 1000, 1000],
    ],
  );
});

test("business settings validate GSTIN and business email formats", () => {
  const s = emptyWorkspace("Studio", "INR");
  const business = {
    legalName: "Studio",
    address: "",
    email: "hello@example.com",
    phone: "",
    gstin: "27AAPFU0939F1ZV",
    state: "Maharashtra",
    paymentTerms: "",
    bankDetails: "",
  };
  applyCommand(s, {
    type: "settings.update",
    name: "Studio",
    currency: "INR",
    business,
  });
  assert.throws(
    () =>
      applyCommand(s, {
        type: "settings.update",
        name: "Studio",
        currency: "INR",
        business: { ...business, gstin: "not-a-gstin" },
      }),
    /GSTIN/i,
  );
  assert.throws(
    () =>
      applyCommand(s, {
        type: "settings.update",
        name: "Studio",
        currency: "INR",
        business: { ...business, email: "invalid" },
      }),
    /email/i,
  );
});

test("GST is split into CGST and SGST in-state and IGST between states", () => {
  const s = emptyWorkspace("Studio", "INR");
  s.business.state = "Maharashtra";
  for (const [name, state] of [
    ["Local", "Maharashtra"],
    ["Remote", "Karnataka"],
  ]) {
    applyCommand(s, {
      type: "lead.create",
      name,
      company: "",
      email: `${name.toLowerCase()}@example.com`,
      value: 10000,
      source: "Website",
      state,
    });
  }
  for (const lead of s.leads) {
    applyCommand(s, {
      type: "document.create",
      kind: "invoice",
      leadId: lead.id,
      dueDate: "2026-12-01",
      items: [
        {
          description: "Consulting",
          quantity: 1,
          unitPrice: 10000,
          taxBps: 1800,
        },
      ],
      taxBps: 0,
      notes: "",
    });
  }
  const remote = s.documents.find(
    (d) => s.leads.find((l) => l.id === d.leadId)?.state === "Karnataka",
  )!;
  const local = s.documents.find(
    (d) => s.leads.find((l) => l.id === d.leadId)?.state === "Maharashtra",
  )!;
  assert.deepEqual(remote.taxSplit, {
    supply: "interstate",
    cgst: 0,
    sgst: 0,
    igst: 1800,
  });
  assert.deepEqual(local.taxSplit, {
    supply: "intrastate",
    cgst: 900,
    sgst: 900,
    igst: 0,
  });
});

test("saving a new lead automatically queues one introduction, excluding edits and demos", () => {
  const s = emptyWorkspace("Orbit", "INR");
  const lead = { type: "lead.create", name: "Asha Mehta", email: "asha@example.com", company: "", value: 0, source: "Website" };
  applyCommand(s, lead);
  assert.equal(s.outbox.length, 1);
  assert.equal(s.outbox[0].to, lead.email);
  assert.match(s.outbox[0].body, /Hi Asha,/);
  applyCommand(s, { ...lead, type: "lead.edit", id: s.leads[0].id });
  s.isDemo = true;
  applyCommand(s, { ...lead });
  assert.equal(s.outbox.length, 1);
});

test("lead phone numbers normalize and survive edits without dropping existing data", () => {
  const s = emptyWorkspace("Shop", "INR");
  const command = { type: "lead.create", name: "Yash", company: "", email: "yash@example.com", value: 1000, source: "Shop", phone: "+91 98765 43210" };
  applyCommand(s, command);
  assert.equal((s.leads[0] as unknown as { phone: string }).phone, "+919876543210");
  applyCommand(s, { ...command, type: "lead.edit", id: s.leads[0].id, phone: undefined });
  assert.equal((s.leads[0] as unknown as { phone: string }).phone, "+919876543210");
  assert.throws(() => applyCommand(s, { ...command, phone: "9876543210" }), /country code/);
});
