import LeadFlow, { type Page } from "@/components/app";
import { notFound } from "next/navigation";

const sections: Record<string, string> = {
  leads: "Leads",
  clients: "Clients",
  "follow-ups": "Follow-ups",
  quotations: "Quotations",
  invoices: "Invoices",
  products: "Products",
  revenue: "Revenue",
  email: "Email",
  feedback: "Feedback",
  settings: "Settings",
};

export default async function AppSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const initialPage = sections[section];
  if (!initialPage) notFound();
  return <LeadFlow initialPage={initialPage as Page} />;
}
