# Foundation verification — 4 November 2026

Scope: production-mode browser gate and planning artifacts on feat/pilot-foundation. No production business logic or database schema changed.

| Check | Result |
| --- | --- |
| npm test | 26/26 passed, local SQLite |
| npm run typecheck | Passed |
| npm run build | Passed after resolving local file permissions and a test typing error |
| npm run test:e2e | 8/8 passed against production Next server with isolated temporary SQLite database |
| Production nonce regression | Two fresh /app loads: matching script nonces, different request nonces, no unsafe-eval, usable sign-in heading, no page errors |
| Existing browser coverage | Account switching, origin rejection, persisted sales journey, mobile overflow, documents, tenant isolation preserved |

Run build before test:e2e. Tests now refuse to reuse an existing server. The test process explicitly disables Resend credentials and PostgreSQL URLs and enables sample workspaces only for its local server. Temporary SQLite data remains under the operating-system temporary directory for inspection; no real customer data is used.

Known tooling warning: Next reports that next start is not the recommended standalone launch command. It served this test successfully. A future Docker/standalone smoke gate must use the packaged standalone server and copied static assets; this run does not validate that packaging.

Not run: fresh PostgreSQL integration suite (local Docker daemon unavailable), live email delivery, live deployment smoke test, full accessibility audit, Lighthouse/field performance, load/security testing or restore drill. Existing CI provisions PostgreSQL for unit/integration tests; browser tests use SQLite. No claim that CI has run this branch yet.

The redesign, team workflow, database transaction changes and delivery worker remain planned in PILOT-FOUNDATION.md. This foundation change has not been deployed.
