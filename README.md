# LeadFlow

A responsive Next.js / TypeScript workspace for service businesses: from first enquiry to recorded payment. The public homepage introduces LeadFlow; the private workspace starts at `/app` and each work area has its own `/app/...` URL.

## Open locally

Requires Node.js 22.13+ (tested on Node 24). Open this folder and double-click **Start LeadFlow.cmd**, then visit **http://127.0.0.1:3000**.

Or run:

```sh
npm ci
npm run dev
```

On macOS or Linux, `./start-leadflow.sh` checks Node.js and opens the local development app. For container deployment, build with `docker build -t leadflow .` and run with a persistent `/app/data` volume, or provide PostgreSQL through `DATABASE_URL`.

Choose **Explore sample workspace** for an independent workspace with clearly labeled fictional records, or **Create account** to start empty. Use a password of at least 12 characters. Data persists in `data/leadflow.sqlite`; it is not browser-only storage. Sample workspaces have random accounts; signing out loses access to that sample account. Create your own account for records you intend to keep.

## Implemented

- Email/password registration, sign-in and revocable cookie sessions; each account owns a separate workspace.
- Contacts with editable details, safe deletion checks, lead stages, list/board views, search, stage filters and CSV export. Won leads appear as clients.
- Reusable product and service catalog with exact thousandth-unit stock, low-stock signals, a movement ledger, server-authoritative pricing/tax, and stock deductions/restoration for issued and voided invoices.
- Scheduled follow-ups, local-calendar due/overdue states, completion and reopening.
- Multi-line quotations, invoices and credit notes, up to three decimal quantity places, per-line configurable tax, HSN/SAC fields, place-of-supply state and CGST/SGST or IGST splits when both states are supplied, validated GSTIN/business email fields, draft/issued/accepted/credited states, and conversion only after quote acceptance.
- Document voiding controls that protect paid records, credit-note balance caps, payment reconciliation and inventory restoration for voided unpaid invoices.
- Authenticated printable documents (browser Print / Save PDF).
- Full/partial payment recording, overpayment prevention and idempotent retry handling. Payment entry records money already received; it does not charge a card.
- Revenue charts and outstanding balances derived from actual stored records.
- Email draft/outbox queue, explicit Resend dispatch, retry state, provider idempotency, limited retry window. Optional email verification and password-reset links are enabled when a verified sender is configured. **Sent** means accepted by the provider, not guaranteed inbox delivery.
- Workspace feedback log, currency settings, light/dark mode, responsive navigation.
- Starter subscription state and identifiers reserved for a payment provider. Public pricing, privacy and terms pages are present; the legal pages are marked as drafts pending operator details and review. No checkout or subscription charges are active.
- Security headers including nonce-based script CSP, trusted-proxy IP and email-pair login throttling, periodic expired-auth cleanup, 48-hour cleanup of new unverified signups, database health endpoint, crawl metadata, and dependency versions pinned to the lockfile.

## Connections still required

### GitHub

The project repository is `https://github.com/ranvirkhalsa203-art/leadflow`. The GitHub connection in ChatGPT can read repositories but cannot push code. To publish from GitHub Desktop, clone this repository, copy the project files into the cloned folder while keeping its hidden `.git` folder, commit on a feature branch and publish that branch. `.github/workflows/ci.yml` runs type checking, the persistence suite against PostgreSQL 16, a production build, and Playwright browser journeys.

### Supabase / hosted PostgreSQL

Set server-only `DATABASE_URL` to a PostgreSQL connection string. Supabase can host this database; **Supabase Auth is not integrated**. Authentication remains application-managed in both local and hosted modes.

Use Supabase's connection panel to choose the appropriate pooler connection for the deployment. The Vercel runtime limits its PostgreSQL pool to one connection per serverless instance; local PostgreSQL uses a small eight-connection pool. See [official connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres). Do not expose database credentials through `NEXT_PUBLIC_*` variables.

The server creates the `lf_*` tables on first connection and enables PostgreSQL Row Level Security with no public policies. The database owner connection performs server operations; anonymous/authenticated browser database API access is denied by RLS. Tenant isolation is enforced by the authenticated server workspace ID. The schema is in `src/lib/db.ts`.

The CI workflow starts PostgreSQL 16 and runs the storage/auth suite against it. A separately credentialed Supabase deployment has not been performed. Use a fresh project for initial deployment. Local SQLite data is not automatically migrated.

### Deployment

Set `DATABASE_URL` and `APP_URL=https://your-exact-hostname` in the hosting environment. `APP_URL` must match the browser's origin; use the exact preview URL for preview deployments. Use Node.js 22.13+ or 24. Build with `npm run build`. Vercel can detect Next.js after GitHub is connected.

SQLite is intentionally rejected on Vercel because its filesystem does not persist reliably. On a persistent Node host, SQLite requires a writable persistent disk and a backup process. The default start command binds to localhost for local safety; use the host's recommended binding for a public server.

Sample signup is disabled in production unless `ENABLE_DEMO=true`. Keep it disabled for an initial private beta. Public deployment has not been performed.

### Email

Set `RESEND_API_KEY` and `EMAIL_FROM` (a sender on your verified domain). See [Resend email API](https://resend.com/docs/api-reference/emails/send-email). Compose and save, then explicitly choose **Send now**. No real emails were sent during development. Without configuration, drafts work and Send is disabled. Automated scheduled reminders and delivery webhooks are not implemented; the outbox is the foundation for a future scheduled worker. Failed sends retain a stable provider idempotency key, and retries stop after the safe retry window.

When email is configured, new accounts must verify their email. Verification and password-reset links expire after 30 minutes; password changes revoke existing sessions. Without a verified sender, local registration works without email verification and password reset is unavailable.

### Subscriptions

The workspace model reserves plan/status/customer/subscription fields. Connecting a key alone does **not** activate billing: checkout, verified webhooks, entitlement enforcement and a billing portal still need implementation. The UI says this plainly.

## MVP limits before public launch

This is a working local/private-beta MVP, not a finished public billing platform. Each workspace currently has one owner; invitations, role-based team membership, MFA, automated reminders, payment links and subscription checkout are not implemented. Settings includes workspace export and password-confirmed account deletion. Feedback is private to the workspace rather than sent to a central support inbox. Currency is locked after financial records exist. GST split requires both business and client states; missing state data remains visibly unspecified. Have a tax professional validate tax rates, place-of-supply and invoice requirements before using these documents as official tax invoices.

Workspace data is stored in workspace-scoped relational tables for leads, products, follow-ups, documents and line items, payments, inventory movements, feedback, email outbox and activity. Business profile, subscription state and workspace settings remain compact metadata. Existing full JSON workspace snapshots are migrated transactionally on first database connection; the old 5 MB snapshot limit no longer applies. Writes are transactional and revisioned. This is a practical MVP foundation, not a promise of unlimited scale: high-volume analytics and large tenants still need load testing, retention policies and possibly a dedicated analytics store.

Passwords use scrypt and session tokens are stored as SHA-256 digests. Cookies are HttpOnly, SameSite=Strict and Secure on HTTPS origins. Mutations enforce origin plus a custom request header. Throttles are persisted by login/signup identity; IP throttling uses Vercel's forwarded client header or an explicitly trusted proxy setting. Configure only behind a trusted proxy. Do not expose the local dev server publicly.

## Verify

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests use real local persistence and real browser interactions. External email and hosted PostgreSQL need their own credentialed acceptance tests. Screenshots are under `docs/previews/`. The test server uses a separate SQLite file when it launches itself; do not point tests at your production database.

## Architecture

- `src/lib/domain.ts`: validated commands, documents, money and payment invariants.
- `src/lib/db.ts`: SQLite/PostgreSQL relational persistence, legacy snapshot migration, versioned writes, throttles.
- `src/lib/auth.ts`: credentials and session lifecycle.
- `src/lib/email.ts`: outbox delivery through Resend.
- `src/app/api/[...path]/route.ts`: authenticated and same-origin HTTP boundary.
- `src/components/`: interactive UI and forms.
- `src/app/documents/[id]/`: owner-scoped printable documents.
- `tests/`, `e2e/`: domain, storage and browser tests.

The lockfile pins the installed dependency tree. Webpack is selected because the restricted Windows environment prevented Turbopack from creating directory junctions. There are no paid-service assumptions in the local run.
