import type { ReactNode } from "react";
export default function PublicPage({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <main className="public-page">
      <header>
        <a className="brand" href="/">
          <span className="brand-mark">✳</span> leadflow
        </a>
        <a className="primary" href="/app">
          Open workspace
        </a>
      </header>
      <article>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {children}
      </article>
      <footer>
        <span>LeadFlow · Less busywork. More business.</span>
        <nav>
          <a href="/pricing">Pricing</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </footer>
    </main>
  );
}
