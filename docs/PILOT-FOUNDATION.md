# LeadFlow: audit and implementation brief

Prepared 4 November 2026. Baseline: origin/main `133f7d8950a0fa2a5dd43cfd2ed1a255eac2ffb7`.
This is a source audit, not a certification or claim of production readiness. Findings below distinguish observed code from risks requiring reproduction. Test results for this change are recorded separately in PILOT-VERIFICATION.md.

## 1. Current architecture and feature map

Next.js App Router serves public pages, a client workspace shell and server API routes. React and TypeScript remain appropriate. PostgreSQL is production storage; SQLite supports local work. `src/lib/db.ts` now stores business entities in relational tables, with JSON workspace metadata. The historical 5 MB workspace blob limit is no longer the current architecture. However, reads and mutations still load the full workspace and compare records before persisting differences.

| Area | Existing implementation | Gap before employee pilot |
| --- | --- | --- |
| Accounts | Custom scrypt passwords, hashed sessions, verification, reset, export/delete | Memberships, roles, atomic token/account changes |
| Leads/customers | CRUD, stages, customer conversion, automatic introduction outbox | Employee assignment, phone, focused pipeline view |
| Follow-ups | Date and completion state | Timezone-aware time, owner, outcomes/history |
| Sales | Quotes, conversion, invoices, payments, voids, credit notes | Request-level replay protection and database constraints review |
| Inventory | Products, milli-unit quantities, movement ledger | Purchase workflow, employee audit identity |
| Indian billing | GST split, HSN/SAC, business validation | Pilot accountant review; no compliance certification |
| Email | Resend adapter, transactional outbox creation, bounded retries/idempotency | Verified sender, background delivery, actionable errors |
| Website | Home, pricing, privacy, terms, account token pages | Full navigation, help, solutions, truthful plan presentation |
| Operations | Health endpoint, Dockerfile, launchers, CI | Restore drill, metrics, alerting, production browser gate |

Runtime dependencies: Next/React, pg, Zod, lucide-react. Tooling: TypeScript, tsx, Playwright, Prettier. No GSAP, MongoDB, Express or Python runtime dependency is necessary today.

## 2. Prioritized findings

| Priority | Evidence | Implication / action |
| --- | --- | --- |
| P1 | User-supplied Resend log returns 403 for test-domain recipient restriction | Customer email and verification cannot be assumed operational. Verify a production sender or separately implement an authenticated Gmail adapter. Keep verification security enabled. |
| P1 | playwright.config.ts starts development server | Production CSP/hydration regressions can escape CI. First change: run production build and assert nonce matching, freshness and usable sign-in. |
| P1 | auth.ts consumes tokens, changes passwords and revokes sessions in separate queries; account deletion also sequential | Failure could leave partial state. Move each operation into one transaction; inject intermediate failures in tests. Risk identified from code, not reproduced in this audit. |
| P1 | User model has one workspaceId, no membership/roles | Employee pilot requires server-enforced access and assignment. Never implement role enforcement only in UI. |
| P1 | db.ts reads multiple tables under READ COMMITTED without a consistent snapshot lock | Concurrent writes may produce a mixed workspace view. Reproduce on PostgreSQL; use consistent read transactions or focused repository queries. |
| P2 | updateWorkspace reads/clones all records before diffing writes | Cost grows with tenant size despite relational storage. Add paginated reads and command-specific transactions incrementally. |
| P2 | Entity relationships lack composite tenant foreign keys | Domain checks protect normal paths but database does not enforce every cross-entity tenant relationship. Add constraints through validated migrations. |
| P2 | Activity is bounded to 100 entries, without actor/before-after details | Insufficient employee audit history. Introduce append-only audit events with retention and export rules. |
| P2 | Schema initialization/legacy migration runs on connections; rate-limit rows accumulate | Versioned migrations and scheduled bounded cleanup are needed. |
| P2 | Lead save awaits email dispatch; provider errors are generic | Saving can wait for the provider and retries are hard to diagnose. Commit quickly, deliver asynchronously, distinguish rejected/accepted/delivered. |
| P2 | app.tsx ~2,097 lines and forms.tsx ~1,015 lines | Split feature modules behind existing behavior tests. |

Security foundations to preserve: nonce CSP and dynamic rendering, origin/header checks for mutations, hashed tokens, server workspace scoping, validation and financial invariants. Enabling RLS alone is not evidence of tenant policies being enforced for the server database role. Review roles/policies separately. Do not claim a completed penetration test.

## 3. Preserve, refactor, replace

Preserve money in minor units, stock in milli-units, inventory ledger, credit/void/quote semantics, domain validation, session hashing, public document rendering and existing regression tests. Preserve the current deployable app throughout.

Refactor workspace storage into repositories and command services; migrate authentication atomically; extract feature UI modules and shared accessible controls. Replace the monolithic screen-switching shell with route-owned screens incrementally, retaining existing deep links. Replace placeholder marketing content with accurate product explanations. Do not replace the whole database or authentication stack during visual work.

## 4. Target website and app information architecture

Public: `/`, `/features`, `/solutions` (electronics shop example first), `/how-it-works`, `/pricing`, `/about`, `/contact`, `/help`, `/privacy`, `/terms`, `/sign-in`, `/register`. Primary promise: **Turn every enquiry into a clear next action.** Primary action: open/create workspace; secondary: explore clearly labelled sample data. No fabricated testimonials, usage numbers or unavailable plans.

Workspace: `/app` overview; `/app/leads`; `/app/pipeline`; `/app/follow-ups`; `/app/customers`; `/app/quotations`; `/app/invoices`; `/app/payments`; `/app/products`; `/app/reports`; `/app/team`; `/app/settings`; `/app/feedback`. Retain redirects from `/app/clients` and `/app/revenue` when replacements ship. Each screen owns query/filter state in URL and provides loading, empty, denied and recoverable error states.

Pilot path: enquiry → assigned employee → next follow-up → contacted/outcome → quote → sale → payment. Overview prioritizes overdue work and next actions over decorative charts. Payment totals distinguish invoiced, received, credited and outstanding.

## 5. Visual design system

Direction: warm paper, deep forest green, restrained lime accent, editorial headlines and compact operational tables. Keep the existing recognizable palette while improving hierarchy and contrast.

| Token | Proposed value / rule |
| --- | --- |
| Canvas / surface | #F7F8F5 / #FFFFFF |
| Primary text / secondary | #202D27 / #53645B; replace low-contrast muted copy |
| Primary / accent | #214D3E / #DCF6A5; dark text on accent |
| Typography | Self-host existing Manrope headings and DM Sans body if licensed assets available; system fallback; no blocking CSS font import |
| Scale | Body 16px public, 14–16px app; H1 fluid 36–64px; table values tabular numerals |
| Spacing | 4px base, section spacing 64–112px public, 16–32px app |
| Shapes | 10–14px panels, 8px controls, minimal shadows |
| Layout | Public max width 1200px; app sidebar + content; mobile drawer and focused action bar |

Components: buttons, labelled fields with inline errors, dialog with focus return, combobox, status badge with text, responsive table with column controls, empty state, toast/live region, timeline, KPI and accessible chart/table pair. Minimum practical touch target 44px. Keyboard-visible focus; no color-only status. Check WCAG AA contrast, 200% zoom and 360/768/1440px layouts before accepting new screens. These are proposed criteria, not measured results.

## 6. Motion system

GSAP is optional progressive enhancement on public pages only. Candidate uses: one short hero reveal and a scroll-linked explanation of the enquiry-to-payment sequence. No scroll hijacking, perpetual ambient animation or hidden content awaiting JS. Use transform/opacity, reserve layout space, retain semantic DOM and visible fallback. Respect prefers-reduced-motion, clean up timelines/listeners on navigation, dynamically load only on applicable pages. Prefer CSS for hover/focus transitions. Verify bundle impact and low-end mobile behavior before adding GSAP; drop it if the value does not justify the cost.

## 7. MERN and Python decisions

Keep Next.js + React + TypeScript + PostgreSQL. MongoDB would weaken the fit for invoices, payments, stock and tenant constraints while creating migration risk. An additional Express server duplicates current routing/auth operations. Neither is justified by the pilot. Extract a service only when independent scaling or integrations require it.

Python can later support offline CSV cleanup, reconciliation analysis or scheduled analytical exports. Keep it out of live authentication, billing and request paths. Any future job must have an explicit owner, input schema, tenant scope, replay policy and tests. No Python service in this stage.

## 8. Target data and delivery architecture

Add workspace memberships and invites; roles owner/admin/manager/sales/viewer with a documented permission matrix. Sales edits assigned leads and own follow-ups; managers assign work; viewers read permitted business data; owner-only ownership/deletion/billing controls. Authorization lives in command services, with cross-tenant and revoked-membership tests. Disallow removal of last owner; reassign employee work explicitly.

Add lead assignee/phone, follow-up dueAt UTC plus workspace timezone and outcome events. WhatsApp initially opens a user-confirmed click-to-chat message; record only user-reported contact outcome, never delivery/read claims.

Introduce numbered migrations with checksums and a dedicated migration command. Expand/backfill/validate/contract changes; do not drop legacy fields in the same release as migration. Use tenant-scoped composite keys, indexed list queries, cursor pagination, request idempotency keys and an append-only audit stream. Back up before migration and prove restore in an isolated database.

Keep outbox insertion atomic with lead creation. A bounded worker claims jobs, retries transient errors with backoff and classifies permanent errors. Provider acceptance is not inbox delivery. Verify signed provider events before updating delivery status. No live email sent by tests. Separate production and preview databases before external testers.

## 9. Phases and acceptance gates

| Phase | Deliverable | Gate |
| --- | --- | --- |
| 0: audit/foundation | This brief, production browser checks, baseline results | Typecheck, unit suite, production build, browser suite; report unavailable checks |
| 1: architecture | Atomic auth operations, versioned migrations, consistent reads | PostgreSQL failure-injection/concurrency tests, SQLite compatibility, backup/restore drill |
| 2: design | Shared tokens/components and route shell | Keyboard, contrast, zoom, responsive visual review; existing journeys unchanged |
| 3: marketing | Public IA and truthful copy; limited optional motion | Links/forms, metadata, no-JS content, reduced-motion, measured mobile performance |
| 4: workspace modules | Feature extraction and paginated queries | Tenant isolation, URL/back navigation, loading/errors and query-size evidence |
| 5: pilot workflows | Memberships/roles, assignment, timed follow-ups, WhatsApp, quotes | Two employees plus owner complete workflow; forbidden operations denied server-side |
| 6: reliability | Delivery worker, audit, restore, observability | Provider failure/replay tests, restore evidence, production smoke tests |
| 7: invited pilot | Electronics shop onboarding and observed use | Real task completion, no unresolved P1, owner acceptance, support/recovery instructions |
| 8: iteration/public release | Fix measured friction; widen access | Pilot evidence and launch checklist, not calendar-only approval |

Proposed measurement targets: mobile LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; record test device/network and field vs lab evidence. Measure list-query latency at realistic tenant sizes before defining service guarantees. Record pilot enquiry entry time, missed follow-ups, quote completion and employee errors with consent. No performance score is asserted here.

## 10. Cost, dependencies and launch constraints

Use local SQLite and existing tools for development. Retain portable Docker deployment and PostgreSQL compatibility. Check current provider commercial-use terms, quotas and backup support before selecting a paid/live plan; free commercial hosting is not promised. No new paid subscription or domain purchase in this stage.

Needed later: working PostgreSQL test environment (local Docker daemon was unavailable during audit), approved production sender connection, staging database and deployment access, backup destination and pilot employee details. Do not request secrets in chat. November 7 is a target for an invited pilot only if gates pass, not a guarantee of public readiness.
