import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { emptyWorkspace } from "./domain";
import { createWorkspace, query, rateLimit } from "./db";
import { sendTransactional, emailConfigured } from "./email";
const derive = promisify(scrypt);
export const sessionCookie = "leadflow_session";
export const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12, "Use at least 12 characters").max(128),
  currency: z.enum(["INR", "USD", "EUR", "GBP", "CAD", "AUD"]).default("INR"),
});
export type User = { id: string; email: string; workspaceId: string };
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
async function passwordHash(value: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(value, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}
async function verify(value: string, stored: string) {
  const [salt, hex] = stored.split(":");
  const actual = (await derive(value, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function session(user: User) {
  const token = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO lf_sessions (token,user_id,expires_at) VALUES ($1,$2,$3)",
    [digest(token), user.id, new Date(Date.now() + 7 * 86400000).toISOString()],
  );
  return { token, user };
}
type RegistrationResult =
  | { user: User; token?: never; verificationRequired: true }
  | { user: User; token: string; verificationRequired: false };
export function register(
  raw: unknown,
): Promise<Extract<RegistrationResult, { verificationRequired: false }>>;
export function register(
  raw: unknown,
  requireVerification: boolean,
): Promise<RegistrationResult>;
export async function register(
  raw: unknown,
  requireVerification = false,
): Promise<RegistrationResult> {
  const data = signupSchema.parse(raw);
  await rateLimit(`signup:${digest(data.email)}`, 5, 3600000);
  const existing = await query("SELECT id FROM lf_users WHERE email=$1", [
    data.email,
  ]);
  if (existing.rows.length)
    throw new Error(
      "Unable to create account with this email. Try signing in.",
    );
  const password = await passwordHash(data.password);
  const workspaceId = crypto.randomUUID();
  const user = { id: crypto.randomUUID(), email: data.email, workspaceId };
  await createWorkspace(workspaceId, emptyWorkspace(data.name, data.currency));
  try {
    await query(
      "INSERT INTO lf_users (id,email,password,workspace_id,email_verified,created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        user.id,
        user.email,
        password,
        workspaceId,
        requireVerification ? 0 : 1,
        new Date().toISOString(),
      ],
    );
  } catch {
    await query("DELETE FROM lf_workspaces WHERE id=$1", [workspaceId]);
    throw new Error(
      "Unable to create account with this email. Try signing in.",
    );
  }
  return requireVerification
    ? { user, verificationRequired: true as const }
    : { ...(await session(user)), verificationRequired: false as const };
}
export async function login(
  email: string,
  password: string,
  trustedClientIp?: string,
) {
  email = z.email().max(254).parse(email).toLowerCase();
  z.string().min(1).max(128).parse(password);
  if (trustedClientIp)
    await rateLimit(`login-ip:${digest(trustedClientIp)}`, 30, 15 * 60 * 1000);
  if (!trustedClientIp)
    await rateLimit(`login-local:${digest(email)}`, 8, 15 * 60 * 1000);
  else
    await rateLimit(
      `login-attempt:${digest(`${email}:${trustedClientIp}`)}`,
      8,
      15 * 60 * 1000,
    );
  const { rows } = await query(
    "SELECT id,email,password,workspace_id,email_verified FROM lf_users WHERE email=$1",
    [email],
  );
  const row = rows[0];
  const valid = await verify(
    password,
    row
      ? String(row.password)
      : "00000000000000000000000000000000:" + "00".repeat(64),
  );
  if (!row || !valid) throw new Error("Email or password is incorrect");
  if (row.email_verified === false || row.email_verified === 0)
    throw new Error("Please verify your email before signing in.");
  return session({
    id: String(row.id),
    email: String(row.email),
    workspaceId: String(row.workspace_id),
  });
}
async function issueAuthToken(userId: string, purpose: "verify" | "reset") {
  const token = randomBytes(32).toString("hex");
  const tokenHash = digest(token);
  await query("DELETE FROM lf_auth_tokens WHERE user_id=$1 AND purpose=$2", [
    userId,
    purpose,
  ]);
  await query(
    "INSERT INTO lf_auth_tokens (token_hash,user_id,purpose,expires_at,consumed_at) VALUES ($1,$2,$3,$4,NULL)",
    [
      tokenHash,
      userId,
      purpose,
      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ],
  );
  return token;
}
export async function sendVerification(
  userId: string,
  email: string,
  appUrl: string,
) {
  if (!emailConfigured()) return;
  const token = await issueAuthToken(userId, "verify");
  await sendTransactional(
    email,
    "Verify your LeadFlow email",
    `Verify your email within 30 minutes: ${appUrl}/verify?token=${token}`,
  );
}
export async function resendVerification(email: string, appUrl: string) {
  const parsed = z.email().max(254).parse(email).toLowerCase();
  await rateLimit(`verify:${digest(parsed)}`, 4, 3600000);
  const { rows } = await query(
    "SELECT id,email,email_verified FROM lf_users WHERE email=$1",
    [parsed],
  );
  if (
    rows[0] &&
    rows[0].email_verified !== true &&
    rows[0].email_verified !== 1
  )
    await sendVerification(String(rows[0].id), parsed, appUrl);
}
export async function verifyEmail(token: string) {
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(token);
  const now = new Date().toISOString();
  const { rows } = await query(
    "UPDATE lf_auth_tokens SET consumed_at=$1 WHERE token_hash=$2 AND purpose='verify' AND consumed_at IS NULL AND expires_at>$1 RETURNING user_id",
    [now, digest(token)],
  );
  if (!rows[0]) throw new Error("This verification link is invalid or expired");
  await query("UPDATE lf_users SET email_verified=$1 WHERE id=$2", [
    1,
    rows[0].user_id,
  ]);
}
export async function requestPasswordReset(email: string, appUrl: string) {
  const parsed = z.email().max(254).parse(email).toLowerCase();
  await rateLimit(`reset:${digest(parsed)}`, 4, 3600000);
  const { rows } = await query("SELECT id FROM lf_users WHERE email=$1", [
    parsed,
  ]);
  if (rows[0] && emailConfigured()) {
    const token = await issueAuthToken(String(rows[0].id), "reset");
    await sendTransactional(
      parsed,
      "Reset your LeadFlow password",
      `Reset your password within 30 minutes: ${appUrl}/reset-password?token=${token}`,
    );
  }
}
export async function resetPassword(token: string, password: string) {
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(token);
  const nextPassword = z.string().min(12).max(128).parse(password);
  const now = new Date().toISOString();
  const { rows } = await query(
    "UPDATE lf_auth_tokens SET consumed_at=$1 WHERE token_hash=$2 AND purpose='reset' AND consumed_at IS NULL AND expires_at>$1 RETURNING user_id",
    [now, digest(token)],
  );
  if (!rows[0]) throw new Error("This password link is invalid or expired");
  await query("UPDATE lf_users SET password=$1 WHERE id=$2", [
    await passwordHash(nextPassword),
    rows[0].user_id,
  ]);
  await query("DELETE FROM lf_sessions WHERE user_id=$1", [rows[0].user_id]);
}
export async function authenticate(
  token: string | undefined,
): Promise<User | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenDigest = digest(token);
  const now = new Date().toISOString();
  const { rows } = await query(
    "SELECT u.id,u.email,u.workspace_id FROM lf_sessions s JOIN lf_users u ON s.user_id=u.id WHERE s.token=$1 AND s.expires_at>$2",
    [tokenDigest, now],
  );
  const row = rows[0];
  return row
    ? {
        id: String(row.id),
        email: String(row.email),
        workspaceId: String(row.workspace_id),
      }
    : null;
}
export async function logout(token: string) {
  await query("DELETE FROM lf_sessions WHERE token=$1", [digest(token)]);
}

export async function deleteAccount(userId: string, password: string) {
  const checkedPassword = z.string().min(1).max(128).parse(password);
  const { rows } = await query(
    "SELECT id,password,workspace_id FROM lf_users WHERE id=$1",
    [userId],
  );
  const row = rows[0];
  if (!row || !(await verify(checkedPassword, String(row.password))))
    throw new Error("Password is incorrect. Your account was not deleted.");
  await query("DELETE FROM lf_sessions WHERE user_id=$1", [userId]);
  await query("DELETE FROM lf_auth_tokens WHERE user_id=$1", [userId]);
  await query("DELETE FROM lf_users WHERE id=$1", [userId]);
  await query(
    "DELETE FROM lf_workspaces WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM lf_users WHERE workspace_id=$1)",
    [row.workspace_id],
  );
}
