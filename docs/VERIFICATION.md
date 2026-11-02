# LeadFlow v2 verification — 2 November 2026

## Passed locally

- `npm run typecheck`: passed.
- `npm test`: 24 tests passed on SQLite. Coverage includes workspace isolation, auth sessions, email verification and one-use reset tokens, IP/email login throttling, serverless PostgreSQL pool sizing, legacy snapshot migration, workspaces larger than 5 MB, concurrent writes, precise fractional stock, movement logging, quote reconversion, invoice credit/void transitions, GSTIN/business email format checks, and existing lead/payment workflows.
- `npm run build`: production bundling and TypeScript passed, but page generation stopped in this Windows environment when Next.js received `EPERM` creating `.next/server/app/_global-error.segments/_global-error`. A complete production build is not verified.
- `npm run test:e2e`: seven browser journeys passed before the storage refactor. A current rerun did not reach the app: the temporary Next.js server did not start listening on port 3000, and the runner was stopped. No browser tests are claimed for the relational-storage version.

## Implemented from the review

- Inventory is stored as integer thousandths; product creation, manual edits, sales and invoice voids add entries to the stock movement ledger. Existing workspace snapshots migrate transactionally to relational records and schema version 4, with legacy stock balances represented as opening entries.
- Fully credited invoices show `credited`; voiding their credit note reopens the balance. An accepted quote can create a replacement invoice after its earlier converted invoice is voided.
- Email verification requires an explicit POST confirmation. Authentication checks no longer delete database rows on every request. Expired auth data and unverified signups older than 48 hours are cleaned opportunistically at most once per process every 15 minutes.
- Login throttles include a trusted IP and email pair to prevent one source from locking an account for everybody. Correct-password unverified sign-ins explain that verification is needed.
- Production script CSP uses a per-request nonce. CI restores Playwright and includes the browser journeys. Generated TypeScript build cache is excluded from packaging.
- Product and service pages include the stock movement history. Business email and GSTIN formats are validated. HSN/SAC snapshots print on documents; Indian GST is split into CGST/SGST or IGST when both business and client states are present.
- The root route is a marketing page; workspace views have separate URLs. A health endpoint, Docker image recipe and macOS/Linux launcher are included.
- Settings can export workspace JSON or delete the account and workspace after confirming the password.
- Workspace entities now use workspace-scoped relational tables rather than a single 5 MB JSON snapshot. Existing snapshots migrate transactionally the first time the database connects; metadata and business profile stay in the workspace row.

## Not verified or not active

- PostgreSQL CI job has not been run locally; no hosted database credentials were available. Supabase persistence and RLS still need a connected staging database test.
- GitHub currently returns no repositories through the connected account; the source ZIP contains no `.git` history. No push or deployment is claimed.
- Resend has not been configured, and no real email was sent. Automated scheduled reminders and delivery webhooks are not implemented.
- Place-of-supply tax split needs both states; missing state data is not guessed. Tax rates and official invoice compliance have not been externally validated. Payment links and subscription checkout are scaffolding only; no money is charged.
- Team roles, client portal, expenses/purchases and Sentry are not implemented.
- Docker image was not built locally. Deployment and subscription billing remain untested.

## Commands

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright uses its own local SQLite file. Never point test commands at production data.
