import type { Metadata } from "next";
import PublicPage from "@/components/public-page";
export const metadata: Metadata = {
  title: "Terms | LeadFlow",
  description: "LeadFlow early access terms.",
};
export default function TermsPage() {
  return (
    <PublicPage
      title="Terms for early access."
      eyebrow="SERVICE TERMS · REVIEW BEFORE PUBLIC LAUNCH"
    >
      <p className="public-note">
        Draft terms for product review. The operator must add its legal entity,
        jurisdiction, effective date and support contact and obtain appropriate
        legal review before accepting public customers.
      </p>
      <h2>Using the service</h2>
      <p>
        LeadFlow is an early access business-record tool. You are responsible
        for the accuracy, lawful collection and safe handling of information
        entered into your workspace. Keep your sign-in details secure and
        promptly report suspected unauthorized access to the service operator.
      </p>
      <h2>Business records and payments</h2>
      <p>
        Quotes, invoices, tax amounts and payment entries are created by you.
        You remain responsible for reviewing documents for accuracy and meeting
        applicable accounting and tax requirements. Recording a payment does not
        charge a client. LeadFlow does not currently offer subscription checkout
        or card processing.
      </p>
      <h2>Availability and data</h2>
      <p>
        Early access features may change. Keep independent copies of important
        business records; automated account export and backup recovery controls
        are not available in this MVP. The service operator should publish a
        support and data-retention policy before public launch.
      </p>
    </PublicPage>
  );
}
