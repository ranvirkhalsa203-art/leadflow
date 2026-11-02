import Link from "next/link";
import {
  ArrowRight,
  Check,
  Layers3,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import PublicPage from "@/components/public-page";

export default function Page() {
  return (
    <PublicPage
      title="The little things that keep business moving."
      eyebrow="YOUR BUSINESS, IN FLOW"
    >
      <div className="landing-hero">
        <p>
          LeadFlow brings your contacts, follow-ups, quotes, invoices and
          payments into one calm workspace, so every good conversation has a
          clear next step.
        </p>
        <div className="landing-actions">
          <Link className="primary" href="/app">
            Open your workspace <ArrowRight size={17} />
          </Link>
          <Link className="secondary" href="/pricing">
            See what’s included
          </Link>
        </div>
        <div className="landing-proof">
          <span>
            <Check size={15} /> Your own private workspace
          </span>
          <span>
            <Check size={15} /> Free while LeadFlow is in early access
          </span>
          <span>
            <Check size={15} /> No card needed
          </span>
        </div>
      </div>
      <section className="landing-features">
        <article className="card">
          <TargetIcon />
          <h2>Keep opportunities warm</h2>
          <p>
            See every lead, client and follow-up together. Know who to contact
            next and keep important conversations from slipping away.
          </p>
        </article>
        <article className="card">
          <Layers3 size={23} />
          <h2>Send clear proposals</h2>
          <p>
            Build reusable services, prepare quotes and turn an accepted
            proposal into an invoice without starting over.
          </p>
        </article>
        <article className="card">
          <Wallet size={23} />
          <h2>See money in motion</h2>
          <p>
            Record payments, watch outstanding balances and understand how your
            revenue is changing over time.
          </p>
        </article>
      </section>
      <section className="landing-closer card">
        <div>
          <span className="eyebrow">LESS BUSYWORK. MORE BUSINESS.</span>
          <h2>From first hello to paid.</h2>
          <p>
            A simpler home for the everyday work behind a healthier business.
          </p>
        </div>
        <Link className="primary" href="/app">
          Get started <ArrowRight size={17} />
        </Link>
      </section>
    </PublicPage>
  );
}

function TargetIcon() {
  return <Users size={23} />;
}
