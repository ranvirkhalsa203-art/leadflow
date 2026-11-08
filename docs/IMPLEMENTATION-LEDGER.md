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


## Phone and migration foundation — 8 November 2026

Reliability commit 100c5e1 passed GitHub CI with PostgreSQL. Added optional international phone numbers to lead create/edit, persisted relationally. Existing clients omitting phone preserve the old value on edit; explicitly empty phone clears it. The lead table offers a WhatsApp draft link only for valid numbers. Opening the draft does not mark the lead contacted or claim delivery.

New numbered/checksummed migration runner serializes PostgreSQL runners with a transaction-scoped advisory lock. SQLite uses its existing serialized transaction. Schema changes and markers commit together; failed migrations roll back and changed historical scripts fail closed. The first migration is additive (phone column with empty default). Legacy table bootstrap is retained for compatibility; replacing all historical setup is separate work. Migrations currently run at connection initialization, as existing schema setup did. Do not deploy until PostgreSQL CI passes and a production backup/restore procedure is agreed.

Verification: 31 SQLite tests, production build and 8 production browser journeys passed. The browser test confirms the normalized WhatsApp URL after reload without opening WhatsApp or sending a message. No migration has been applied to the live database by this task.
