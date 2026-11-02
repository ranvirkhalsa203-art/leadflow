# LeadFlow MVP

Approved direction: a premium responsive Next.js/TypeScript SaaS for small service businesses, from enquiry to payment. New isolated project approved by the user on 2026-11-01. No accessible GitHub repositories were returned.

## Approach
Use Next.js App Router with server-only persistence and secure cookie sessions. SQLite makes the complete local MVP usable without services; a PostgreSQL adapter supports Supabase hosting through DATABASE_URL. Authentication is application-managed, not Supabase Auth. All records belong to one owner workspace. Multi-member invitations, OAuth, password reset and email verification are later work and must be disclosed before public launch.

Alternative: Supabase-only would block local workflows on credentials. Browser-only mock storage would not meet the real-workflow requirement. The chosen adapter keeps server-side persistence and tenant checks in both environments.

## Scope
Sign up/sign in/sign out; isolated owner workspaces; leads and clients; follow-up scheduling/completion; quotes and invoices with line items, integer minor-unit totals and tax; quote conversion; partial payments and outstanding revenue; feedback; email outbox with explicit dispatch and retry; subscription plan/status structure without simulated charging. Dashboard totals derive from stored records. One currency per workspace, initially INR; no mixed-currency aggregation. Optional seeded sample workspace clearly labeled.

## Experience
Warm ivory canvas, deep forest sidebar, lime accents, spacious cards, readable typography, mobile navigation, dark mode. Empty states invite meaningful actions. Forms validate, errors remain visible, pending actions disable repeat clicks. Search and filters operate on real workspace data. Printable invoices support browser Save as PDF.

## Security and correctness
Scrypt passwords, hashed opaque session tokens, HttpOnly SameSite cookies, origin checks on mutations, persistent login throttling, validated input, no client-provided workspace selection. Single-row workspace version compare-and-swap prevents lost writes. PostgreSQL RLS denies direct public API access; only server DB credentials operate tables. Money uses integer cents and rejects overpayment. Idempotency keys protect payment retries.

## Verification
Domain tests cover rounding, invalid amounts, document transitions, payment replay/overpayment and references. Database integration tests cover tenant isolation and concurrent writes. Browser tests cover registration, the customer-to-payment journey and mobile navigation. Production build and TypeScript checks required. Hosted database, email delivery and deployment remain unverified without credentials.
