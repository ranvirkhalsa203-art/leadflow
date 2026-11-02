"use client";

import { useState, type FormEvent } from "react";

export default function AccountAction({
  mode,
  token,
}: {
  mode: "verify" | "reset";
  token: string;
}) {
  const [message, setMessage] = useState(
    mode === "verify"
      ? "Confirm your email address to activate your workspace."
      : "Choose a new password.",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function confirmEmail() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-leadflow": "1" },
        body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Verification failed");
      setMessage("Your email is verified. You can sign in now.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const password = new FormData(e.currentTarget).get("password");
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-leadflow": "1" },
        body: JSON.stringify({ token, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Unable to reset password");
      setMessage(
        "Password updated. Your other sign-in sessions have been closed.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-action">
      <div className="brand">
        <span className="brand-mark">✳</span> leadflow
      </div>
      <section className="card">
        <span className="eyebrow">ACCOUNT SECURITY</span>
        <h1>
          {mode === "verify" ? "Confirm your email" : "Choose a new password"}
        </h1>
        <p>{message}</p>
        {mode === "verify" && !message.startsWith("Your email is verified") && (
          <button className="primary" disabled={busy} onClick={confirmEmail}>
            {busy ? "Confirming…" : "Confirm email address"}
          </button>
        )}
        {mode === "reset" && !message.startsWith("Password updated") && (
          <form className="settings-form" onSubmit={submit}>
            <label className="field">
              <span>New password</span>
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <a className="primary" href="/app">
          Return to LeadFlow
        </a>
      </section>
    </main>
  );
}
