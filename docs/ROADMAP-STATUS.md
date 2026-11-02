# LeadFlow roadmap status

Updated 2 November 2026.

## Launch target

- Website first; Android is deferred. Target an invited private beta by 7 November 2026, then widen access after the first launch checks.
- The local source is ready for a web release candidate. There is no live site or hosted database yet, so the date depends on publishing the source and connecting hosting promptly.

## Implemented locally

- PostgreSQL-backed CI job that runs the storage/auth tests with PostgreSQL 16, type checking and a production build.
- Dependencies pinned to the versions in the lockfile.
- Fractional quantities (up to three decimal places), per-line tax rates, GSTIN and business details on printable documents.
- Email verification and password reset flows, with expiring, one-use tokens and session revocation after password changes.
- Reusable product/service catalog, optional inventory counts, low-stock indicators and stock movements when invoices are issued or voided.
- Contact editing and safe deletion checks; quotation issue/accept/convert lifecycle; document voiding and balance-capped credit notes.
- Public pricing, privacy and terms pages plus sitemap, robots and Open Graph metadata.
- Production security headers, session expiry cleanup, trusted-proxy IP throttling and the existing revenue/activity views.
- Workspace data moved from the single 5 MB JSON snapshot into workspace-scoped relational tables for leads, products, follow-ups, documents and line items, payments, inventory movements, feedback, mail outbox and activity. Settings and business profile remain compact workspace metadata.
- Existing full workspace snapshots migrate transactionally on first connection, preserving the prior revision and converting legacy inventory to opening movements. New and migrated workspaces use schema version 4.
- Storage coverage now checks one-time legacy migration, tenant isolation, concurrent updates and a workspace with more than 5 MB of entity data.
- Vercel PostgreSQL pools are capped at one connection per serverless instance; local PostgreSQL keeps the existing eight-connection pool.
- Settings support workspace export and password-confirmed account deletion.

## Needs service connections or owner decisions

- **GitHub:** The correct repository is `https://github.com/ranvirkhalsa203-art/leadflow`. It is reachable, but neither visible remote branch currently contains `package.json` or app source. The ChatGPT GitHub connection is read-only; publish the project from GitHub Desktop on a feature branch. The project ZIP is the current complete source copy.
- **PostgreSQL hosting:** The CI job uses a temporary PostgreSQL service. A real Supabase project and its server-only `DATABASE_URL` are still needed for hosted data. Local SQLite data is not migrated automatically.
- **Deployment:** No Vercel project or deployment credentials are connected. Set the exact hosted `APP_URL` and `DATABASE_URL` before deploying.
- **Android:** Deferred until after the website launch. Android Studio, Java and the Android SDK are not installed in this development environment, and no Android project exists yet.
- **Email:** Set `RESEND_API_KEY` and a verified `EMAIL_FROM` value to send messages, verify account emails and deliver reset links. No real email was sent.
- **Error monitoring:** The existing app has workspace activity and revenue analytics. Sentry SDK wiring is not included yet; connect a Sentry project and provide its DSN to add external error reporting.
- **Payment links and automated reminders:** Choose a payment provider and supply its credentials. Scheduled reminders also need an authorized hosting scheduler and email delivery. No charges are enabled.
- **Public policies and tax documents:** The privacy and terms pages are marked as drafts. Add the operator’s legal identity, privacy contact, jurisdiction and retention policy and obtain appropriate review. Confirm local GST and invoice requirements before treating generated documents as tax invoices.

## Not included in this pass

Team invitations and roles, MFA, payment-provider checkout/webhooks, central feedback support inbox, and scheduled reminder workers remain future work. The standalone production build and Playwright rerun still need verification on a machine where Next.js can create its generated folders and the configured local port is available.
