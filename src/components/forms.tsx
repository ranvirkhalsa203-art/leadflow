"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Layers3 } from "lucide-react";
import { Field } from "./field";
export async function api(path: string, data?: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), data === undefined ? 12000 : 25000);
  try {
    const r = await fetch(`/api/${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: data === undefined ? {} : { "Content-Type": "application/json", "x-leadflow": "1" },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || "Request failed");
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(data === undefined
      ? "Loading is taking too long. Please retry."
      : "Confirmation is taking too long. Refresh and check whether your change was saved before trying again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export function Auth({
  onSuccess,
  demoEnabled,
}: {
  onSuccess: () => Promise<void>;
  demoEnabled: boolean;
}) {
  const [signup, setSignup] = useState(false),
    [recovery, setRecovery] = useState<"reset" | "verify" | null>(null),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (recovery) {
        await api(
          recovery === "reset" ? "auth/reset-request" : "auth/verify-resend",
          Object.fromEntries(f),
        );
        setNotice(
          recovery === "reset"
            ? "If an account exists and email is connected, a reset link is on its way."
            : "If verification is needed and email is connected, a new link is on its way.",
        );
        return;
      }
      const result = await api(
        signup ? "auth/register" : "auth/login",
        Object.fromEntries(f),
      );
      if (result.verificationRequired) {
        setNotice("Check your inbox to verify your email before signing in.");
        return;
      }
      await onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    setError("");
    try {
      await api("auth/demo", {});
      await onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Layers3 size={23} />
          </span>
          leadflow<span className="brand-dot">®</span>
        </div>
        <div className="auth-story-main">
          <span className="eyebrow light">LESS BUSYWORK. MORE BUSINESS.</span>
          <h1>
            Your business.
            <br />{ " " }
            One clear view.
          </h1>
          <p>
            Your leads, your clients, your next big win.
            <br />
            One beautifully connected workspace.
          </p>
          <div className="story-art">
            <div className="art-label">
              <span className="live-dot" /> YOUR BUSINESS, IN FLOW{" "}
              <span>↗</span>
            </div>
            <div className="art-amount">
              From hello
              <br />
              <em>to paid.</em>
            </div>
            <div className="art-steps">
              <span>New lead</span>
              <i />
              <span>Proposal</span>
              <i />
              <span className="art-paid">Paid ✓</span>
            </div>
            <div className="art-bars">
              {[30, 45, 40, 62, 50, 72, 64, 88, 77, 100, 90, 120].map(
                (v, i) => (
                  <i key={i} style={{ height: v }} />
                ),
              )}
            </div>
          </div>
        </div>
        <div className="auth-foot">
          Built for independent businesses. <span>Made for what’s next.</span>
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-top">
          Your business, in one place <span>✳</span>
        </div>
        <form className="auth-form" onSubmit={submit} aria-busy={busy}>
          <span className="eyebrow">WELCOME TO LEADFLOW</span>
          <h2>
            {recovery
              ? recovery === "reset"
                ? "Reset your password."
                : "Resend verification."
              : signup
                ? "Set up your business."
                : "Welcome back."}
          </h2>
          <p>
            {recovery
              ? "Enter your account email address."
              : signup
                ? "Start with your business name. Add products and customers when you’re ready."
                : "Sign in to see your customers, follow-ups and payments."}
          </p>
          {!recovery && (
            <div className="auth-tabs">
              <button
                type="button"
                disabled={busy}
                className={!signup ? "selected" : ""}
                onClick={() => {
                  setSignup(false);
                  setError("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                disabled={busy}
                className={signup ? "selected" : ""}
                onClick={() => {
                  setSignup(true);
                  setError("");
                }}
              >
                Create account
              </button>
            </div>
          )}
          {!recovery && signup && (
            <Field label="Business name">
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                placeholder="Your shop or business"
                autoComplete="organization"
              />
            </Field>
          )}
          <Field label="Email address">
            <input
              name="email"
              type="email"
              required
              placeholder="you@company.com"
              autoComplete="email"
            />
          </Field>
          {!recovery && (
            <Field label="Password">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={signup ? 12 : 1}
                maxLength={128}
                placeholder={
                  signup ? "At least 12 characters" : "Enter your password"
                }
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </Field>
          )}
          {!recovery && (
            <button type="button" className="text-button password-toggle" aria-pressed={showPassword}
              onClick={() => setShowPassword(value => !value)}>
              {showPassword ? "Hide password" : "Show password"}
            </button>
          )}
          {!recovery && signup && (
            <Field label="Business currency">
              <select name="currency">
                <option value="INR">INR — Indian Rupee</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="AUD">AUD — Australian Dollar</option>
              </select>
            </Field>
          )}
          {notice && (
            <p className="hint" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={busy} className="primary wide" type="submit">
            {busy
              ? (recovery ? "Sending link…" : signup ? "Creating your business…" : "Signing in…")
              : recovery
                ? recovery === "reset"
                  ? "Send reset link"
                  : "Resend link"
                : signup
                  ? "Create business"
                  : "Sign in to your business"}
            <ArrowRight size={17} />
          </button>
          {!signup && !recovery && (
            <div className="auth-recovery">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setRecovery("reset");
                  setError("");
                  setNotice("");
                }}
              >
                Forgot password?
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setRecovery("verify");
                  setError("");
                  setNotice("");
                }}
              >
                Resend verification
              </button>
            </div>
          )}
          {recovery && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setRecovery(null);
                setNotice("");
                setError("");
              }}
            >
              Back to sign in
            </button>
          )}
          {demoEnabled && (
            <>
              <div className="or-line">or take a look around</div>
              <button
                disabled={busy}
                className="secondary wide"
                type="button"
                onClick={demo}
              >
                Explore sample workspace
                <ArrowRight size={17} />
              </button>
              <p className="fine-print">
                A separate workspace with sample data. No credit card.
              </p>
            </>
          )}
        </form>
        <div className="auth-bottom">
          A clear head. A healthier business.{" "}
          <span>LeadFlow © {new Date().getFullYear()}</span>
          <nav className="auth-legal">
            <a href="/pricing">Pricing</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </nav>
        </div>
      </section>
    </div>
  );
}
