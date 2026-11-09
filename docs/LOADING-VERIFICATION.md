# Loading responsiveness — 9 November 2026

Observed causes: every API call awaited auth cleanup, which initialized the database even for public config and signed-out state; client requests had no deadline; lead creation awaited email delivery (provider timeout 15 seconds) and reread the entire workspace.

Changes: public config and missing-session state avoid database initialization. Auth maintenance runs after authenticated responses. Customer creation returns the committed workspace immediately and schedules the persisted introduction with Next after. No automatic mutation retries; timed-out mutations explicitly tell users to check saved state first. Reads time out after 12 seconds, mutations after 25 seconds; failed startup offers Retry loading.

Reproduced before fixing: unavailable-database config returned 503 instead of 200; stalled startup never offered recovery. Both regression tests now pass. Fresh results: 31 SQLite tests, production build including TypeScript, 10 production browser tests, plus 1 unavailable-database test passed. CI includes the unavailable-database gate. No live database changes or emails.

Limits: after is a bounded post-response attempt, not a durable scheduled worker. The outbox persists before scheduling and retains existing retry/idempotency logic; interruption still requires outbox review/retry. Provider delivery and production latency have not been measured for this change. Refresh the app to see completed background email status. Existing standalone-start warning remains. Full-workspace queries and cold database schema setup still need separate measured optimization. No broad speed multiplier or universal load-time guarantee is claimed.
