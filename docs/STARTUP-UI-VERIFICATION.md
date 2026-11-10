# Startup UI and efficiency verification — 10 November 2026

Scope: focused startup/login/mobile polish based on the approved direction. Existing business commands and schema remain unchanged.

Implemented:
- Editor extracted unchanged into editor.tsx and dynamically imported only when needed. Shared labelled fields moved to field.tsx.
- Removed blocking external Google Fonts CSS import and use system fonts. This trades bespoke fonts for fewer dependencies and predictable initial rendering.
- Startup and failure card with meaningful status, Retry and homepage escape; respects existing bounded request waits.
- Browser storage is optional: blocked theme persistence no longer crashes startup.
- Business wording replaces workspace wording during setup. Password show/hide, descriptive submission feedback, 48px primary controls, 16px inputs, stronger muted-text contrast and visible keyboard focus.

Evidence:
- Before change: blocked browser storage prevented Welcome back from appearing; password visibility control absent. New regressions failed on the previous build.
- 31 SQLite tests pass. Production build including TypeScript passes. 12 production browser tests pass, including the two new startup/mobile cases. Unavailable-database smoke test passes (additional one test).
- Main app chunk before: 65,179 bytes. First refactored build: 54,734 bytes; separate editor chunk 12,269 bytes. These are uncompressed file sizes, not total page bytes, network transfer sizes or a measured live speedup. Final copy/style polish may change sizes slightly.
- Browser test confirms no Google Fonts requests. Existing sales/editor and tenant-isolation journeys pass after extraction.
- Visually inspected 390px sign-in and 1440px startup previews; corrected joined heading text found in the mobile preview. No full accessibility audit claimed.
- Independent source review found no actionable regressions; reviewer did not rerun tests.

Deployment: prior loading fixes were merged into main via PR #5 (969a8f9). This increment is on feat/startup-polish; not deployed by this task. No secrets or production customer data used. CI result must be checked after push.

Remaining: live deployment identity and performance measurements; cold database initialization and full-workspace query cost; background email worker/delivery verification; backup restoration. These are not solved by a new loading screen. Team memberships/QR, paid analytics and AI remain planned rather than displayed as operational features. Standalone launch warning remains a packaging verification task.
