import { after, NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ZodError, z } from "zod";
import {
  authenticate,
  deleteAccount,
  login,
  logout,
  register,
  sessionCookie,
  requestPasswordReset,
  resetPassword,
  resendVerification,
  sendVerification,
  verifyEmail,
} from "@/lib/auth";
import {
  getWorkspace,
  updateWorkspace,
  rateLimit,
  cleanupExpiredAuthRecords,
  checkDatabase,
} from "@/lib/db";
import { applyCommand } from "@/lib/domain";
import { dispatchEmail, emailConfigured } from "@/lib/email";
import { sampleWorkspace } from "@/lib/seed";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const demoEnabled = () =>
  process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO === "true";
function trustedClientIp(req: NextRequest) {
  // Trust platform-provided client IP only on Vercel, or behind an explicitly trusted proxy.
  if (process.env.VERCEL === "1")
    return req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (process.env.LEADFLOW_TRUST_PROXY === "true")
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return undefined;
}
async function handler(req: NextRequest) {
  const path = req.nextUrl.pathname.replace("/api/", "");
  try {
    if (path === "health" && req.method === "GET") {
      await checkDatabase();
      return json({ status: "ok" });
    }
    if (req.method === "POST") {
      const origin = req.headers.get("origin");
      const expected = process.env.APP_URL
        ? new URL(process.env.APP_URL).origin
        : `${req.nextUrl.protocol}//${req.headers.get("host")}`;
      if (origin !== expected || req.headers.get("x-leadflow") !== "1")
        return json({ error: "Request origin not allowed" }, 403);
      if (Number(req.headers.get("content-length") || 0) > 100000)
        return json({ error: "Request too large" }, 413);
    }
    if (path === "config" && req.method === "GET")
      return json({ demoEnabled: demoEnabled() });
    const token = req.cookies.get(sessionCookie)?.value;
    if (req.method === "GET") {
      const user = await authenticate(token);
      if (!user) return json({ error: "Please sign in" }, 401);
      after(async () => {
        try { await cleanupExpiredAuthRecords(); }
        catch { console.error("LeadFlow auth maintenance failed"); }
      });
      if (path === "state")
        return json({
          user,
          workspace: await getWorkspace(user.workspaceId),
          integrations: {
            database: process.env.DATABASE_URL ? "PostgreSQL" : "Local SQLite",
            email: emailConfigured(),
            billing: false,
          },
        });
      if (path === "account/export") {
        const workspace = await getWorkspace(user.workspaceId);
        const response = NextResponse.json(
          { user: { email: user.email }, workspace },
          {
            headers: {
              "Cache-Control": "no-store",
              "Content-Disposition":
                'attachment; filename="leadflow-workspace.json"',
            },
          },
        );
        return response;
      }
      return json({ error: "Not found" }, 404);
    }
    const raw = await req.text();
    if (raw.length > 100000) return json({ error: "Request too large" }, 413);
    const body = raw ? JSON.parse(raw) : {};
    if (
      [
        "auth/register",
        "auth/login",
        "auth/demo",
        "auth/reset-request",
        "auth/reset-password",
        "auth/verify",
        "auth/verify-resend",
      ].includes(path)
    ) {
      const appUrl = (
        process.env.APP_URL ||
        `${req.nextUrl.protocol}//${req.headers.get("host")}`
      ).replace(/\/$/, "");
      const clientIp = trustedClientIp(req);
      if (
        clientIp &&
        ["auth/register", "auth/reset-request", "auth/verify-resend"].includes(
          path,
        )
      ) {
        const limit = path === "auth/register" ? 20 : 12;
        const identity = createHash("sha256").update(clientIp).digest("hex");
        await rateLimit(`${path}:${identity}`, limit, 60 * 60 * 1000);
      }
      if (path === "auth/reset-request") {
        await requestPasswordReset(body.email, appUrl);
        return json({ ok: true });
      }
      if (path === "auth/reset-password") {
        await resetPassword(body.token, body.password);
        return json({ ok: true });
      }
      if (path === "auth/verify-resend") {
        await resendVerification(body.email, appUrl);
        return json({ ok: true });
      }
      if (path === "auth/verify") {
        await verifyEmail(body.token);
        return json({ ok: true });
      }
      if (path === "auth/demo" && !demoEnabled())
        return json({ error: "Sample workspaces are disabled" }, 403);
      const result =
        path === "auth/login"
          ? await login(body.email, body.password, trustedClientIp(req))
          : await register(
              path === "auth/demo"
                ? {
                    name: "Northstar Studio",
                    email: `sample-${crypto.randomUUID()}@example.invalid`,
                    password: crypto.randomUUID() + crypto.randomUUID(),
                    currency: "INR",
                  }
                : body,
              path === "auth/register" && emailConfigured(),
            );
      if (
        path === "auth/register" &&
        "verificationRequired" in result &&
        result.verificationRequired
      ) {
        await sendVerification(result.user.id, result.user.email, appUrl);
        return json({ ok: true, verificationRequired: true });
      }
      if (path === "auth/demo")
        await updateWorkspace(result.user.workspaceId, () => sampleWorkspace());
      const response = json({ ok: true });
      if (!("token" in result) || !result.token)
        return json(
          { ok: false, error: "Email verification is required" },
          400,
        );
      response.cookies.set(sessionCookie, result.token, {
        httpOnly: true,
        secure: new URL(process.env.APP_URL || req.url).protocol === "https:",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 86400,
      });
      return response;
    }
    const user = await authenticate(token);
    if (!user) return json({ error: "Please sign in" }, 401);
      after(async () => {
        try { await cleanupExpiredAuthRecords(); }
        catch { console.error("LeadFlow auth maintenance failed"); }
      });
    if (path === "account/delete") {
      await deleteAccount(user.id, body.password);
      const response = json({ ok: true });
      response.cookies.set(sessionCookie, "", {
        httpOnly: true,
        secure: new URL(process.env.APP_URL || req.url).protocol === "https:",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
    if (path === "auth/logout") {
      await logout(token!);
      const response = json({ ok: true });
      response.cookies.set(sessionCookie, "", {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
    if (path === "command") {
      await rateLimit(`commands:${user.workspaceId}`, 300, 60000);
      const workspace = await updateWorkspace(user.workspaceId, (s) => applyCommand(s, body));
      if (body.type !== "lead.create" || workspace.isDemo || !workspace.leads[0]?.email)
        return json({ workspace });
      const notice = emailConfigured()
        ? "Lead saved. Introduction queued. Check Email for sending status."
        : "Lead saved. Introduction queued in Email until a sender is connected.";
      if (emailConfigured()) {
        const messageId = workspace.outbox[0].id;
        after(async () => {
          try { await dispatchEmail(user.workspaceId, messageId); }
          catch { console.error("LeadFlow queued introduction delivery failed"); }
        });
      }
      return json({ workspace, notice });
    }
    if (path === "email/send") {
      await dispatchEmail(user.workspaceId, z.string().uuid().parse(body.id));
      return json({ workspace: await getWorkspace(user.workspaceId) });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof ZodError)
      return json(
        {
          error: e.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .join("; "),
        },
        400,
      );
    if (e instanceof SyntaxError)
      return json({ error: "Invalid request body" }, 400);
    const message = e instanceof Error ? e.message : "Something went wrong";
    if (
      /SQLITE|ECONN|password authentication|relation |connect |database |syntax error|ENOTFOUND/i.test(
        message,
      )
    ) {
      console.error("LeadFlow storage request failed");
      return json(
        { error: "Storage is unavailable. Check the server configuration." },
        503,
      );
    }
    return json({ error: message }, 400);
  }
}
export const GET = handler;
export const POST = handler;
