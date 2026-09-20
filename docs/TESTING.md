# Verification record

Date: 2026-09-19

## Executed successfully

- `npm run build`: production bundle builds.
- `npm test`: **33 tests** pass.
  - Official/custom Images API field filtering, size validation, prompt limits, transparent-output constraints, SSE parsing, and image-response handling.
  - Pollinations parameter schema, quality and `n=1` restrictions, extensions, error details.
  - English default, bilingual interpolation, language subscriptions, unchanged user prompts, translation-key coverage.
  - PKCE RFC 7636 vector; unsafe environment rejection; server-session expiry/capacity/deletion.
  - Mocked OAuth discovery/code exchange: correct client/redirect/state/challenge; empty account scopes; secure cookies; ID rotation; no token in session JSON; wallet balance projection; logout.
  - Wrong state, consent denial, single-use callback/replay, untrusted discovered token endpoint, sanitized exchange failure.
  - Capability-based model catalog normalization.
- Browser workflows:
  - `node tests/publication-browser.mjs`: public catalog, attribution, default Pollinations mode, honest unconfigured-login gate, no private-Key form in public mode, public privacy route, simulated authorized wallet/edit/logout, no delegated key in browser image headers/storage, English/Chinese mobile layouts at 320/390 px.
  - `node tests/browser.mjs`: historical custom API workflows, JSON/multipart + painted mask, SSE, errors, local collection, favorites, persistence, key cleared on refresh.
  - `node tests/pollinations-browser.mjs`: historical operator-enabled manual provider mode, Pollinations parameters and field-level errors.
  - `node tests/language-browser.mjs`: language persistence, preserved input, stable collection filters, mobile controls.
- Real public, non-billable services checked:
  - Pollinations `/image/models` returned a catalog; current reference capabilities were read.
  - Official OAuth discovery returned metadata; this did not authorize an account.
- Current production-mode preview starts, `/api/app` correctly reports `authReady: false`, and an unauthenticated image request is rejected. No fake sign-in is offered.

- `npm run check:release`: correctly reports missing production origin and App Key, with custom forwarding disabled. Its nonzero status is an expected release gate, not a passed live-auth test.

## What mocks do — and do not — prove

Backend OAuth tests inject a fake discovery/token service. UI tests simulate a signed-in state and image responses where needed. They validate our application logic without charging an account. They do **not** prove that a not-yet-created App Key has been registered correctly, that your production cookies/proxy work, or that a model is available to your account.

The public catalog call is live and free of user credentials. Generation/edit test images are fixtures, not purported output from a real paid request.

## Pending before submission

- Register the operator's App Key and exact production callback.
- Deploy to permanent public HTTPS hosting.
- Complete an actual end-to-end OAuth consent and callback using that App Key.
- Perform one actual billable generation and one reference edit, with the operator's consent and a small budget.
- Check real insufficient-budget, provider revocation, expiry, and reauthentication behavior.
- Verify production TLS, Cookie attributes, Origin checking behind the final trusted proxy, and log redaction.
- Build/run the Docker deployment. Docker files are provided but were not executed in the current sandbox.
- Add final source/contact URLs as desired and review policies for the operator's jurisdiction.

Only after these steps should the draft submission be presented as a working deployed app.
