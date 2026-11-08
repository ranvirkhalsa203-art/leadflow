# Implementation ledger

## Reliability stage — 4 November 2026

Reproduced: injecting an error into the user update after consuming a verification token left the token consumed. Regression test failed with a timestamp where NULL was required.

Changed: registration groups workspace, user and initial session creation in one transaction. Token replacement, email verification, password reset/session revocation and account deletion now use transactions. PostgreSQL token replacement serializes on the user row. Account deletion checks the password while holding the user lock. Multi-table workspace reads hold a tenant share lock matching the existing writer lock.

Tests inject database failures during verification, reset session revocation and final workspace deletion, then assert that token use, password, user and sessions are retained. Trigger conditions are scoped to the test account to avoid affecting other PostgreSQL test processes. Tests do not use live email.

Local results: 28 unit/integration tests passed on SQLite; typecheck passed; production build and all 8 production browser journeys passed. PostgreSQL behavior requires CI verification before merge. No production migration or deployment performed.

Ruling: keep reliability changes separate from employee schema changes so rollback and review remain manageable. No team/assignment interface is represented as complete by this commit.

## Remaining execution stages

1. Versioned migrations and PostgreSQL concurrency/failure validation, including restore exercise.
2. Memberships/invitations and server-enforced owner/admin/manager/sales/viewer permissions; prevent last-owner removal.
3. Lead phone/employee assignment, timezone-aware follow-up deadlines, outcomes and history.
4. User-confirmed WhatsApp click-to-chat, with no delivery/read claims.
5. Design system and public/app route improvements from PILOT-FOUNDATION.md.
6. Real sender integration, background email worker and pilot acceptance checks.

The complete requested upgrade is still in progress. This ledger records a tested stage, not launch approval.

