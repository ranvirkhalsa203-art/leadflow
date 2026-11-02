# LeadFlow website beta — 7 November 2026

## Release target

Launch the existing website to a small invited group first. Keep Android Studio work for after the website is stable. Do not enable subscription charges or describe payment recording as card processing; the app does not charge cards.

## Already in the project

- Leads and clients, follow-ups, product and stock tracking, quotes, invoices, credit notes, recorded payments and revenue views.
- Owner accounts, workspace isolation, export and account deletion.
- Relational workspace storage with automatic migration from the former JSON snapshots.
- Email outbox, verification and password reset flows when a verified email sender is configured.
- Health endpoint, CI workflow, responsive layout, and a local Windows launcher.

## Required before inviting beta users

1. **Publish the source to GitHub.** The repository currently has no app files on its visible branches. In GitHub Desktop, publish the project files from the ZIP to a feature branch in `ranvirkhalsa203-art/leadflow`. The ChatGPT GitHub connection is read-only.
2. **Create hosted PostgreSQL.** Connect a fresh Supabase database to Vercel with the server-only `DATABASE_URL`. Vercel must use PostgreSQL; the local SQLite file is not durable there. The app creates its `lf_*` tables the first time it connects. Check `/api/health` after deployment.
3. **Deploy the website.** Import the published branch into Vercel. Set `APP_URL` to the exact Vercel site origin. Keep `ENABLE_DEMO=false`.
4. **Configure email.** Add a verified sender through Resend and set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel. This enables account verification and password resets. No keys should be pasted into chat or committed to GitHub.
5. **Finish the legal pages.** Supply the business/legal name, privacy contact, jurisdiction and data-retention policy for the draft privacy and terms pages. Get the required local review before storing real client records.
6. **Pass the hosted checks.** Run CI against PostgreSQL 16, complete the production build and all Playwright journeys, then manually check signup, reset, two-workspace isolation, a quote-to-invoice-to-payment flow, export/delete, and the dashboard at phone width.
7. **Prepare the beta.** Start with invited users, confirm support contact and database backup/restore, and keep billing disabled.

## Suggested schedule

| Date | Goal |
| --- | --- |
| 2–3 Nov | Publish project source; create Supabase and Vercel projects; connect staging database. |
| 4 Nov | Configure email sender and complete business/legal details. |
| 5 Nov | Pass PostgreSQL CI, production build and browser journeys; fix any launch-blocking defects. |
| 6 Nov | Production smoke check, backup/restore check, invited-user list and support contact ready. |
| 7 Nov | Invite the private beta group and monitor the first real workflows. |

## Known limits for this beta

- Android app: deferred. Android Studio, Java and the Android SDK are not installed in this environment, and no Android project exists.
- Subscription checkout, payment links, team roles, automated reminder workers, client portal, expenses and Sentry are not included.
- PostgreSQL and the complete production build have not yet been verified against the owner’s hosted services. The latest local SQLite suite passes 24 tests; see `VERIFICATION.md`.
- The source ZIP is local. No live site URL is available to inspect until the code is pushed and deployed.
