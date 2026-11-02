import type { Metadata } from "next";
import PublicPage from "@/components/public-page";
export const metadata: Metadata = {
  title: "Pricing | LeadFlow",
  description: "LeadFlow plans for independent businesses.",
};
export default function PricingPage() {
  return (
    <PublicPage
      title="A calmer way to run your business."
      eyebrow="SIMPLE, TRANSPARENT PLANS"
    >
      <section className="pricing-grid">
        <div className="card">
          <span className="eyebrow">STARTER</span>
          <h2>Free during early access</h2>
          <p>Everything currently available in the LeadFlow workspace.</p>
          <ul>
            <li>Separate business workspace</li>
            <li>Contacts, follow-ups and pipeline</li>
            <li>Quotes, invoices and payment tracking</li>
            <li>Feedback and email outbox</li>
          </ul>
          <a className="primary" href="/app">
            Create a workspace
          </a>
        </div>
        <div className="card featured">
          <span className="eyebrow">GROWING TEAMS</span>
          <h2>Plans coming soon</h2>
          <p>
            Team seats, payment links and automated reminders are being
            prepared. No charge is active today.
          </p>
          <ul>
            <li>Subscription checkout is not enabled</li>
            <li>No card details are collected</li>
            <li>Pricing will be published before billing</li>
          </ul>
          <a className="secondary" href="/app">
            Explore LeadFlow
          </a>
        </div>
      </section>
      <p className="public-note">
        LeadFlow is an early access product. Product availability and terms may
        change before paid plans launch.
      </p>
    </PublicPage>
  );
}
