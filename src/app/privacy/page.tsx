import type { Metadata } from "next";
import PublicPage from "@/components/public-page";
export const metadata: Metadata = {
  title: "Privacy | LeadFlow",
  description: "How LeadFlow handles workspace data.",
};
export default function PrivacyPage() {
  return (
    <PublicPage
      title="Privacy, in plain language."
      eyebrow="PRIVACY NOTICE · REVIEW BEFORE PUBLIC LAUNCH"
    >
      <p className="public-note">
        This starter notice describes the current MVP and must be completed with
        the operator’s legal identity, hosting region, retention rules and
        contact address before public launch.
      </p>
      <h2>Information stored</h2>
      <p>
        LeadFlow stores account email and password hashes, workspace contacts,
        follow-ups, quotations, invoices, payment records, feedback and email
        drafts. Passwords are stored as scrypt hashes. Workspace records are
        isolated by the signed-in account.
      </p>
      <h2>Service providers</h2>
      <p>
        When configured, the application operator’s database provider stores
        workspace data and Resend delivers emails that an owner chooses to send.
        Email delivery is not enabled until the operator supplies a verified
        sender. Do not enter payment card details; LeadFlow does not process
        card charges.
      </p>
      <h2>Your choices</h2>
      <p>
        Users can request a password reset by email when email delivery is
        configured. Contact editing is available in the workspace. Account
        export, account deletion and retention controls are not yet available in
        this MVP.
      </p>
      <h2>Security and contact</h2>
      <p>
        LeadFlow uses encrypted HTTPS cookies on hosted deployments and
        server-side access checks. No online service can promise absolute
        security. The operator must add a monitored privacy contact and the
        applicable regional rights and retention requirements before launch.
      </p>
    </PublicPage>
  );
}
