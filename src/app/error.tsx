"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Let’s try that again.</h1>
      <p>
        LeadFlow couldn’t load this page. Your saved records are still in the
        database.
      </p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
