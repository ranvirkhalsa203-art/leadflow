# Startup and sign-in polish implementation plan

Goal: reduce unnecessary startup dependencies and make loading, failure recovery and business sign-in clear on phones.
Architecture: preserve the Next.js modular monolith, nonce CSP and current business commands. Split the editing UI into an on-demand chunk, keep shared fields independent, use local system fonts, and provide accessible startup/error states. No new UI libraries or schema changes.
Tech stack: current Next/React/TypeScript, CSS, Playwright.

Approved direction: user requested speed, startup/login improvements and the previously discussed calm mobile-first design. Ruling: implement this focused increment; enterprise roles, QR and AI remain separate stages.

1. Record startup dependency baseline; add regression tests for font independence, password visibility, storage-disabled startup and recoverable errors. Observe failures.
2. Extract editor.tsx and field.tsx from forms.tsx. Load Editor with next/dynamic only when a modal opens. Preserve existing editor behavior and journeys.
3. Remove Google Fonts CSS import; use platform fonts. Add startup card and error/retry screen with accessible status and safe-area spacing; tolerate unavailable local storage.
4. Clarify business setup wording and sign-in progress. Add accessible password visibility control; disable mode changes while submitting.
5. Run unit suite, production build, browser suite and unavailable-database gate. Record source/bundle evidence, limitations and deployment status. Push isolated branch; do not silently deploy.
