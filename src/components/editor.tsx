"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X, Plus, Trash2, ArrowRight } from "lucide-react";
import { formatMoney, paidAmount, type Workspace, type LineItem } from "@/lib/domain";
import { localDate } from "@/lib/client-utils";
import { Field } from "./field";
export type ModalKind =
  | "lead"
  | "product"
  | "followup"
  | "invoice"
  | "quote"
  | "credit"
  | "payment"
  | "email"
  | "feedback";
export function Editor({
  kind,
  recordId,
  s,
  onClose,
  onSave,
}: {
  kind: ModalKind;
  recordId?: string;
  s: Workspace;
  onClose: () => void;
  onSave: (data: unknown) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const doc = s.documents.find((d) => d.id === recordId);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [items, setItems] = useState<LineItem[]>(
    kind === "credit" && doc
      ? [
          {
            description: `Credit for ${doc.number}`,
            quantity: 1,
            unitPrice: 0,
            taxBps: 0,
          },
        ]
      : [{ description: "", quantity: 1, unitPrice: 0 }],
  );
  const [tax, setTax] = useState(0);
  const [paymentKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const lead = s.leads.find((l) => l.id === recordId);
  const titles = {
    lead: lead ? "Update contact details" : "A new opportunity",
    product: "Add a product or service",
    followup: "Keep the conversation going",
    invoice: "Create an invoice",
    quote: "Create a quotation",
    credit: "Prepare a credit note",
    payment: "Record a payment",
    email: "Compose an email",
    feedback: "Help shape LeadFlow",
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    let command: unknown;
    if (kind === "lead")
      command = {
        type: recordId ? "lead.edit" : "lead.create",
        ...(recordId ? { id: recordId } : {}),
        ...f,
        value: Math.round(Number(f.value) * 100),
      };
    if (kind === "product")
      command = {
        type: "product.create",
        ...f,
        hsnSac: String(f.hsnSac || "").trim(),
        unitPrice: Math.round(Number(f.unitPrice) * 100),
        taxBps: Math.round(Number(f.taxRate) * 100),
        trackInventory: f.trackInventory === "on",
        stockOnHandMilli: Math.round(Number(f.stockOnHand || 0) * 1000),
        lowStockAtMilli: Math.round(Number(f.lowStockAt || 0) * 1000),
      };
    if (kind === "followup") command = { type: "followup.create", ...f };
    if (kind === "invoice" || kind === "quote" || kind === "credit")
      command = {
        type: "document.create",
        ...f,
        ...(kind === "credit" && doc
          ? { leadId: doc.leadId, relatedDocumentId: doc.id }
          : {}),
        kind,
        items,
        taxBps: Math.round(tax * 100),
      };
    if (kind === "payment")
      command = {
        type: "payment.create",
        ...f,
        documentId: recordId,
        amount: Math.round(Number(f.amount) * 100),
        idempotencyKey: paymentKey,
      };
    if (kind === "email") command = { type: "email.queue", ...f };
    if (kind === "feedback") command = { type: "feedback.create", ...f };
    try {
      await onSave(command);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const clients = (
    <Field label="Client">
      <select
        name="leadId"
        required
        defaultValue={
          kind === "credit" && doc
            ? doc.leadId
            : recordId && kind !== "payment"
              ? recordId
              : ""
        }
      >
        <option value="" disabled>
          Select a contact
        </option>
        {s.leads.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} · {l.company || "Individual"}
          </option>
        ))}
      </select>
    </Field>
  );
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  const due = localDate(dueDate);
  return (
    <dialog
      ref={dialog}
      className="editor"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <header>
          <div>
            <span className="eyebrow">MAKE YOUR NEXT MOVE</span>
            <h2>{titles[kind]}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="editor-body">
          {kind === "lead" && (
            <>
              {!recordId && !s.isDemo && (
                <p>Saving this lead automatically queues a welcome email to their contact address.</p>
              )}
              <Field label="Contact name">
                <input
                  name="name"
                  required
                  maxLength={200}
                  placeholder="e.g. Asha Mehta"
                  defaultValue={lead?.name}
                />
              </Field>
              <div className="form-grid">
                <Field label="Company">
                  <input
                    name="company"
                    maxLength={200}
                    placeholder="e.g. Orbit Studio"
                    defaultValue={lead?.company}
                  />
                </Field>
                <Field label="Contact email">
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="asha@orbit.com"
                    defaultValue={lead?.email}
                  />
                </Field>
              </div>
              <Field label="Phone (optional, include country code)">
                <input name="phone" type="tel" maxLength={40} placeholder="+919876543210" defaultValue={lead?.phone ?? ""} />
                <small>Used to open a WhatsApp draft. You review and send the message yourself.</small>
              </Field>
              <div className="form-grid">
                <Field label="Deal value">
                  <div className="input-prefix">
                    <span>{s.currency}</span>
                    <input
                      name="value"
                      type="number"
                      required
                      min="0"
                      max="100000000"
                      step="0.01"
                      defaultValue={lead ? lead.value / 100 : 0}
                    />
                  </div>
                </Field>
                <Field label="Source">
                  <select name="source">
                    <option>Website</option>
                    <option>Referral</option>
                    <option>LinkedIn</option>
                    <option>Instagram</option>
                    <option>Outbound</option>
                    <option>Other</option>
                  </select>
                </Field>
              </div>
              <Field label="State / region (for GST place of supply)">
                <input
                  name="state"
                  maxLength={100}
                  defaultValue={lead?.state ?? ""}
                  placeholder="e.g. Maharashtra"
                />
              </Field>
            </>
          )}
          {kind === "product" && (
            <>
              <Field label="Product or service name">
                <input
                  name="name"
                  required
                  maxLength={200}
                  placeholder="e.g. Brand identity package"
                />
              </Field>
              <Field label="Description">
                <textarea
                  name="description"
                  rows={3}
                  maxLength={1000}
                  placeholder="Optional details for your team"
                />
              </Field>
              <Field label="HSN / SAC code (optional)">
                <input
                  name="hsnSac"
                  inputMode="numeric"
                  pattern="[0-9]{0,8}"
                  maxLength={8}
                  placeholder="Digits only"
                />
              </Field>
              <div className="form-grid">
                <Field label={`Unit price (${s.currency})`}>
                  <input
                    name="unitPrice"
                    type="number"
                    min="0"
                    max="100000000"
                    step="0.01"
                    required
                  />
                </Field>
                <Field label="GST / tax rate (%)">
                  <input
                    name="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue="0"
                    required
                  />
                </Field>
              </div>
              <Field label="Track inventory">
                <input type="checkbox" name="trackInventory" />
              </Field>
              <div className="form-grid">
                <Field label="Stock on hand">
                  <input
                    name="stockOnHand"
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.001"
                    defaultValue="0"
                  />
                </Field>
                <Field label="Low stock alert at">
                  <input
                    name="lowStockAt"
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.001"
                    defaultValue="0"
                  />
                </Field>
              </div>
            </>
          )}
          {kind === "followup" && (
            <>
              {clients}
              <Field label="Follow-up title">
                <input
                  name="title"
                  required
                  maxLength={200}
                  placeholder="e.g. Discuss the proposal"
                />
              </Field>
              <Field label="Due date">
                <input
                  name="dueDate"
                  type="date"
                  required
                  defaultValue={localDate()}
                />
              </Field>
            </>
          )}
          {(kind === "invoice" || kind === "quote" || kind === "credit") && (
            <>
              <div className="form-grid">
                {clients}
                <Field label="Due date">
                  <input
                    name="dueDate"
                    type="date"
                    required
                    defaultValue={due}
                  />
                </Field>
              </div>
              <div className="line-items">
                {items.map((item, i) => (
                  <div className="line-item" key={i}>
                    {s.products.some((p) => p.active) && (
                      <Field label={`Catalog ${i + 1}`}>
                        <select
                          aria-label={`Choose catalog item ${i + 1}`}
                          defaultValue=""
                          onChange={(e) => {
                            const product = s.products.find(
                              (p) => p.id === e.target.value,
                            );
                            setItems(
                              items.map((v, j) =>
                                j !== i
                                  ? v
                                  : product
                                    ? {
                                        ...v,
                                        description: product.name,
                                        unitPrice: product.unitPrice,
                                        taxBps: product.taxBps,
                                        productId: product.id,
                                        hsnSac: product.hsnSac,
                                      }
                                    : {
                                        ...v,
                                        productId: undefined,
                                        hsnSac: undefined,
                                      },
                              ),
                            );
                          }}
                        >
                          <option value="">Custom</option>
                          {s.products
                            .filter((p) => p.active)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                    )}
                    <Field label={`Description ${i + 1}`}>
                      <input
                        required
                        value={item.description}
                        placeholder="Service or deliverable"
                        onChange={(e) =>
                          setItems(
                            items.map((v, j) =>
                              j === i
                                ? { ...v, description: e.target.value }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label={`Quantity ${i + 1}`}>
                      <input
                        type="number"
                        min="0.001"
                        max="10000"
                        step="0.001"
                        required
                        value={item.quantity}
                        onChange={(e) =>
                          setItems(
                            items.map((v, j) =>
                              j === i
                                ? { ...v, quantity: Number(e.target.value) }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label={`Unit price ${i + 1}`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max="100000000"
                        required
                        value={item.unitPrice / 100 || ""}
                        onChange={(e) =>
                          setItems(
                            items.map((v, j) =>
                              j === i
                                ? {
                                    ...v,
                                    unitPrice: Math.round(
                                      Number(e.target.value) * 100,
                                    ),
                                  }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label={`Tax % ${i + 1}`}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        aria-label={`Tax rate ${i + 1}`}
                        value={(item.taxBps ?? Math.round(tax * 100)) / 100}
                        onChange={(e) =>
                          setItems(
                            items.map((v, j) =>
                              j === i
                                ? {
                                    ...v,
                                    taxBps: Math.round(
                                      Number(e.target.value) * 100,
                                    ),
                                  }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove line ${i + 1}`}
                        onClick={() =>
                          setItems(items.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-button"
                disabled={items.length >= 50}
                onClick={() =>
                  setItems([
                    ...items,
                    { description: "", quantity: 1, unitPrice: 0 },
                  ])
                }
              >
                <Plus size={15} />
                Add line item
              </button>
              <div className="form-grid">
                <Field label="Default tax rate (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(Number(e.target.value))}
                  />
                </Field>
                <div className="form-total">
                  <span>Total · {s.currency}</span>
                  <strong>
                    {formatMoney(
                      items.reduce((a, v) => a + v.quantity * v.unitPrice, 0) +
                        Math.round(
                          (items.reduce(
                            (a, v) => a + v.quantity * v.unitPrice,
                            0,
                          ) *
                            Math.round(tax * 100)) /
                            10000,
                        ),
                      s.currency,
                    )}
                  </strong>
                </div>
              </div>
              <Field label="Notes">
                <textarea
                  name="notes"
                  maxLength={2000}
                  placeholder="Payment terms or a personal thank-you"
                  rows={2}
                />
              </Field>
              <p className="hint">
                Saved as a draft. You can issue it and print it from your
                documents.
              </p>
            </>
          )}
          {kind === "payment" && doc && (
            <>
              <div className="info-box">
                <strong>{doc.number}</strong>
                <span>
                  Outstanding{" "}
                  {formatMoney(doc.total - paidAmount(s, doc.id), s.currency)}
                </span>
              </div>
              <Field label="Amount received">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max={(doc.total - paidAmount(s, doc.id)) / 100}
                  step="0.01"
                  required
                  defaultValue={(doc.total - paidAmount(s, doc.id)) / 100}
                />
              </Field>
              <Field label="Payment method">
                <select name="method">
                  <option>Bank transfer</option>
                  <option>UPI</option>
                  <option>Card</option>
                  <option>Cash</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label="Reference">
                <input
                  name="reference"
                  maxLength={200}
                  placeholder="Transaction ID or a note"
                />
              </Field>
              <p className="hint">
                Record money you have already received. This does not charge
                your client.
              </p>
            </>
          )}
          {kind === "email" && (
            <>
              {clients}
              <Field label="Subject">
                <input
                  name="subject"
                  required
                  maxLength={200}
                  placeholder="Following up on our conversation"
                />
              </Field>
              <Field label="Message">
                <textarea
                  name="body"
                  required
                  rows={6}
                  maxLength={10000}
                  placeholder="Hi there…"
                />
              </Field>
              <p className="hint">
                This saves an email to your outbox. Sending is a separate
                action.
              </p>
            </>
          )}
          {kind === "feedback" && (
            <>
              <Field label="Category">
                <select name="category">
                  <option>Feature request</option>
                  <option>Bug report</option>
                  <option>General feedback</option>
                </select>
              </Field>
              <Field label="Your feedback">
                <textarea
                  name="message"
                  required
                  minLength={5}
                  maxLength={4000}
                  rows={5}
                  placeholder="What would make your workday better?"
                />
              </Field>
              <p className="hint">Saved in your workspace’s feedback log.</p>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              (["invoice", "quote", "credit", "followup", "email"].includes(
                kind,
              ) &&
                s.leads.length === 0)
            }
          >
            {busy
              ? "Saving…"
              : {
                  lead: "Save lead",
                  product: "Save product",
                  followup: "Save follow-up",
                  invoice: "Save invoice",
                  quote: "Save quotation",
                  credit: "Save credit note",
                  payment: "Save payment",
                  email: "Save to outbox",
                  feedback: "Save feedback",
                }[kind]}
            <ArrowRight size={16} />
          </button>
        </footer>
        {["invoice", "quote", "credit", "followup", "email"].includes(kind) &&
          s.leads.length === 0 && (
            <p className="error">Add a lead or client first.</p>
          )}
      </form>
    </dialog>
  );
}
