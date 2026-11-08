/** International numbers only; never guess a customer's country. */
export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s().-]/g, "");
}

export function whatsappDraft(phone: string | undefined, name: string, business: string): string | null {
  const normalized = normalizePhone(phone ?? "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null;
  const message = `Hi ${name}, this is ${business}. I'm following up on your enquiry. How can we help?`;
  return `https://wa.me/${normalized.slice(1)}?text=${encodeURIComponent(message)}`;
}
