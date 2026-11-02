import { applyCommand, emptyWorkspace } from "./domain";
export function sampleWorkspace() {
  const s = emptyWorkspace("Northstar Studio", "INR");
  s.isDemo = true;
  const date = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const people = [
    ["Olivia Rhye", "Layers", "olivia@example.com", 2800000, "Referral"],
    ["Phoenix Baker", "Sisyphus", "phoenix@example.com", 1850000, "Website"],
    ["Lana Steiner", "Catalog", "lana@example.com", 4200000, "LinkedIn"],
    ["Demi Wilkinson", "Circooles", "demi@example.com", 1600000, "Referral"],
    ["Drew Cano", "Hourglass", "drew@example.com", 3250000, "Website"],
    ["Natali Craig", "Quotient", "natali@example.com", 2400000, "LinkedIn"],
  ] as const;
  const stages = [
    "proposal",
    "qualified",
    "won",
    "contacted",
    "won",
    "new",
  ] as const;
  people.forEach(([name, company, email, value, source], i) => {
    applyCommand(s, {
      type: "lead.create",
      name,
      company,
      email,
      value,
      source,
    });
    s.leads[0].status = stages[i];
  });
  for (let i = 0; i < 6; i++) {
    const lead = s.leads[i];
    applyCommand(s, {
      type: "document.create",
      kind: i === 5 ? "quote" : "invoice",
      leadId: lead.id,
      dueDate: date(i - 3),
      items: [
        {
          description: [
            "Brand identity & strategy",
            "Website design sprint",
            "Monthly creative retainer",
          ][i % 3],
          quantity: 1,
          unitPrice: lead.value,
        },
      ],
      taxBps: 0,
      notes: "Thank you for trusting Northstar Studio.",
    });
    const doc = s.documents[0];
    if (doc.kind === "invoice") {
      applyCommand(s, { type: "document.issue", id: doc.id });
      if (i < 4) {
        applyCommand(s, {
          type: "payment.create",
          documentId: doc.id,
          amount: i === 0 ? doc.total / 2 : doc.total,
          method: "Bank transfer",
          reference: "Sample payment",
          idempotencyKey: `seed-payment-${i}`,
        });
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        s.payments[0].createdAt = d.toISOString();
      }
    }
  }
  [
    ["Send revised brand proposal", 0, 0],
    ["Discovery call with Phoenix", 4, 0],
    ["Check in on website scope", 2, 1],
    ["Share onboarding checklist", 1, -1],
  ].forEach(([title, index, days]) =>
    applyCommand(s, {
      type: "followup.create",
      leadId: s.leads[Number(index)].id,
      title,
      dueDate: date(Number(days)),
    }),
  );
  return s;
}
