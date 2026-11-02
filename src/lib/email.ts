import { updateWorkspace, rateLimit } from "./db";
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
export async function sendTransactional(
  to: string,
  subject: string,
  text: string,
) {
  if (!emailConfigured()) throw new Error("Email delivery is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error("Email provider did not accept the message");
}
export async function dispatchEmail(workspaceId: string, id: string) {
  if (!emailConfigured())
    throw new Error(
      "Connect an email provider before sending. Your draft is saved.",
    );
  await rateLimit(`email:${workspaceId}`, 30, 3600000);
  let payload: { to: string; subject: string; body: string } | undefined;
  await updateWorkspace(workspaceId, (s) => {
    const m = s.outbox.find((m) => m.id === id);
    if (!m) throw new Error("Email not found");
    if (m.status === "sent") throw new Error("Email already sent");
    if (
      m.status === "sending" &&
      m.lastAttempt &&
      Date.now() - Date.parse(m.lastAttempt) < 300000
    )
      throw new Error("This email is already sending");
    if (
      m.firstAttempt &&
      Date.now() - Date.parse(m.firstAttempt) > 23 * 3600000
    )
      throw new Error(
        "Retry window expired. Check delivery with your provider before composing another email.",
      );
    if (m.attempts >= 5)
      throw new Error("Retry limit reached. Check your email provider.");
    m.firstAttempt ??= new Date().toISOString();
    m.status = "sending";
    m.attempts++;
    m.lastAttempt = new Date().toISOString();
    payload = { to: m.to, subject: m.subject, body: m.body };
    return s;
  });
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `leadflow-${id}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [payload!.to],
        subject: payload!.subject,
        text: payload!.body,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        "The email provider did not accept this message. Check sender configuration and retry.",
      );
    await updateWorkspace(workspaceId, (s) => {
      const m = s.outbox.find((m) => m.id === id)!;
      m.status = "sent";
      m.error = undefined;
      return s;
    });
  } catch (error) {
    await updateWorkspace(workspaceId, (s) => {
      const m = s.outbox.find((m) => m.id === id)!;
      m.status = "failed";
      m.error =
        "Delivery was not confirmed. Retry uses the same provider idempotency key.";
      return s;
    });
    throw error;
  }
}
