# Phone-first customer capture — 11 November 2026

Customers can be saved with a phone number or email. Email remains validated when supplied. Edits must retain at least one contact method. Phone-only customers do not create welcome messages; manually composing an email without an address produces a clear error. Phone numbers are searchable. Walk-in is available as the initial source.

No database schema change, data migration, dependency or background worker was added. Existing email delivery configuration is still required for real messages.

Validation: 32 unit/integration tests, TypeScript and production build passed. Browser results are recorded in the task response.
