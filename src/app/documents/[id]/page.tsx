import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { authenticate, sessionCookie } from "@/lib/auth";
import { getWorkspace } from "@/lib/db";
import {
  formatMoney,
  paidAmount,
  creditedAmount,
  outstandingAmount,
} from "@/lib/domain";
import PrintButton from "@/components/print-button";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await authenticate((await cookies()).get(sessionCookie)?.value);
  if (!user) redirect("/app");
  const s = await getWorkspace(user.workspaceId);
  const { id } = await params;
  const d = s.documents.find((d) => d.id === id);
  if (!d) notFound();
  const client = s.leads.find((l) => l.id === d.leadId)!;
  const money = (n: number) => formatMoney(n, s.currency);
  return (
    <>
      <div className="print-toolbar">
        <a href="/app">← Back to LeadFlow</a>
        <PrintButton />
      </div>
      <article className="invoice-paper">
        <header className="invoice-head">
          <div>
            <h1>{s.business.legalName || s.name}</h1>
            <p>{s.business.email || user.email}</p>
            {s.business.phone && <p>{s.business.phone}</p>}
            {s.business.address && (
              <p style={{ whiteSpace: "pre-line" }}>{s.business.address}</p>
            )}
            {s.business.gstin && <p>GSTIN: {s.business.gstin}</p>}
          </div>
          <div>
            <span className="eyebrow">
              {d.kind === "invoice"
                ? "INVOICE"
                : d.kind === "credit"
                  ? "CREDIT NOTE"
                  : "QUOTATION"}
            </span>
            <p>
              <strong>{d.number}</strong>
            </p>
            <p>
              {d.status.toUpperCase()}
              {s.isDemo ? " · SAMPLE" : ""}
            </p>
          </div>
        </header>
        <section className="invoice-address">
          <div>
            <small>Prepared for</small>
            <strong>{client.name}</strong>
            <p>{client.company}</p>
            <p>{client.email}</p>
          </div>
          <div>
            <small>Document details</small>
            <p>Created: {d.createdAt.slice(0, 10)}</p>
            <p>
              {d.kind === "quote" ? "Valid until" : "Due"}: {d.dueDate}
            </p>
            {d.relatedDocumentId && (
              <p>
                Applies to:{" "}
                {s.documents.find((x) => x.id === d.relatedDocumentId)?.number}
              </p>
            )}
            <p>Currency: {s.currency}</p>
            {s.currency === "INR" && (
              <p>Place of supply: {client.state || "Not provided"}</p>
            )}
          </div>
        </section>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>HSN / SAC</th>
              <th>Qty</th>
              <th className="right">Unit price</th>
              <th className="right">Tax</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((item, i) => (
              <tr key={i}>
                <td>{item.description}</td>
                <td>{item.hsnSac || "—"}</td>
                <td>{item.quantity}</td>
                <td className="right">{money(item.unitPrice)}</td>
                <td className="right">
                  {(item.taxBps ?? d.taxBps) / 100}% ·{" "}
                  {money(
                    Math.round(
                      (Math.round(item.quantity * item.unitPrice) *
                        (item.taxBps ?? d.taxBps)) /
                        10000,
                    ),
                  )}
                </td>
                <td className="right">
                  {money(Math.round(item.quantity * item.unitPrice))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="invoice-totals">
          <div>
            <span>Subtotal</span>
            <span>{money(d.subtotal)}</span>
          </div>
          <div>
            <span>Tax</span>
            <span>{money(d.tax)}</span>
          </div>
          {d.taxSplit?.supply === "intrastate" && (
            <>
              <div>
                <span>CGST</span>
                <span>{money(d.taxSplit.cgst)}</span>
              </div>
              <div>
                <span>SGST</span>
                <span>{money(d.taxSplit.sgst)}</span>
              </div>
            </>
          )}
          {d.taxSplit?.supply === "interstate" && (
            <div>
              <span>IGST</span>
              <span>{money(d.taxSplit.igst)}</span>
            </div>
          )}
          <div className="grand">
            <span>Total</span>
            <span>{money(d.total)}</span>
          </div>
          {d.kind === "invoice" && (
            <>
              <div>
                <span>Payments received</span>
                <span>{money(paidAmount(s, d.id))}</span>
              </div>
              <div className="grand">
                <span>Balance due</span>
                <span>
                  {money(
                    d.total - paidAmount(s, d.id) - creditedAmount(s, d.id),
                  )}
                </span>
              </div>
            </>
          )}
        </div>
        {d.notes && <div className="invoice-note">{d.notes}</div>}
        {s.business.paymentTerms && (
          <div className="invoice-note">
            <strong>Payment terms</strong>
            <br />
            {s.business.paymentTerms}
          </div>
        )}
        {s.business.bankDetails && (
          <div className="invoice-note">
            <strong>Payment details</strong>
            <br />
            {s.business.bankDetails}
          </div>
        )}
        <footer className="invoice-signoff">
          <span>Thank you for your business.</span>
          <span>Prepared with LeadFlow</span>
        </footer>
      </article>
    </>
  );
}
