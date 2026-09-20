# Atelier — Pollinations Image Studio

**English** | [简体中文](README.zh-CN.md)

A quiet, bilingual image studio powered by [Pollinations](https://pollinations.ai). Generate from a prompt, edit with reference images, and keep a local collection. English is the default; Simplified Chinese is available from the language menu.

**Live:** <https://image.xt1171.eu.org> — the deployment has a registered public App Key, so sign-in works and users spend their own authorized Pollen balance. This is an independent community project: no official listing, endorsement, or free-access claim is implied.

- **中文发布指南 / requirements checklist:** [docs/PUBLISHING.zh-CN.md](docs/PUBLISHING.zh-CN.md)
- **App submission draft:** [docs/APP-SUBMISSION.md](docs/APP-SUBMISSION.md)
- **Verification record:** [docs/TESTING.md](docs/TESTING.md)

## Quick start

Node.js 20.19+; Node.js 22 LTS recommended.

```bash
npm ci
cp .env.example .env
npm run dev
# http://localhost:3000
```

Without an App Key, you can inspect the workspace, inspiration gallery, live public model catalog, local collection, language controls, and privacy/terms pages. The sign-in dialog explicitly explains the missing configuration. There are no fake sign-ins or fabricated API results.

Production:

```bash
npm ci
npm run build
npm start
```

The server binds `0.0.0.0:$PORT`, default 3000. Frontend and backend must share an origin. The app needs a long-running Node server; this edition is **not** a GitHub Pages-only static site.

## Set up official Pollinations sign-in

1. Deploy the app to a permanent HTTPS origin, for example `https://atelier.your-domain.com`.
2. Create a **public App Key** at <https://enter.pollinations.ai/keys>. It has a `pk_` prefix and acts as an OAuth client ID, **not** a bearer key used to generate images.
3. Register the exact callback URL: `https://atelier.your-domain.com/auth/callback`.
4. Set these environment variables, then restart:

```dotenv
PUBLIC_APP_URL=https://atelier.your-domain.com
POLLINATIONS_APP_KEY=YOUR_REGISTERED_PUBLIC_PK_KEY
POLLINATIONS_BUDGET=1
POLLINATIONS_EXPIRY_DAYS=7
ENABLE_CUSTOM_PROVIDERS=false
```

The first two values must be your own real deployment values. `YOUR_REGISTERED_PUBLIC_PK_KEY` is documentation text, not a valid key. The included `.env.example` leaves them empty deliberately.

`PUBLIC_APP_URL` must be a root origin with no path/query/fragment. HTTP is allowed only for a loopback local test origin. Register the corresponding loopback callback if testing OAuth locally.

### Authorization design

- OAuth authorization-code flow with **PKCE S256** and a cryptographically random, single-use `state`.
- Endpoints are discovered from Pollinations' OAuth metadata, with issuer and endpoint origins pinned to `https://enter.pollinations.ai`.
- No profile, account-admin, or usage-history scopes are requested. Generation needs no account scope. The user's approved spending cap and expiry constrain the delegated key.
- Authorization-code exchange happens on the backend.
- The delegated `sk_` token lives **only in server memory**. It is never returned to frontend JavaScript, stored in localStorage/sessionStorage, or inserted into URLs/logs.
- Browser receives a random **HttpOnly, SameSite=Lax** session cookie, marked **Secure** on a configured HTTPS origin. Successful login rotates the session ID.
- Local sessions last at most 12 hours or until the earlier token expiry. Server restarts sign everyone out. This is intentionally a **single-instance** deployment; multiple replicas require a properly secured shared session store.
- Session-authenticated image requests are pinned to Pollinations. They cannot use a custom Base URL, Organization, or Project to redirect the delegated credential elsewhere.
- Disconnect removes the local server session. It does **not** revoke the delegated key in the provider dashboard. A visible link lets users manage/revoke access there.
- Budgeted keys can expose their remaining authorized balance without the `usage` scope. A 403 balance response is explained without assuming generation is unavailable.
- No refresh tokens and no automatic retries of potentially billable generation calls.

## Publication-facing features

- Visible **Powered by Pollinations** attribution in the header and footer, linked to the provider.
- Clear independent-project disclaimer; no claim of official acceptance or endorsement.
- Official sign-in as the primary path, rather than asking users for a long-lived private key.
- Explicit Pollen usage, suggested spending cap, expiry, model pricing links, and possible App Key markup disclosure.
- `/privacy` and `/terms` URLs, available in English and Chinese.
- Live public image catalog from `/image/models`, refreshed through a fixed server-side endpoint. Editing requires both image-input capability and the edit endpoint; published reference limits are enforced again on the backend.
- Resolution choices appear for models that advertise them. Unsupported Pollinations masks, variations, streaming, compression, transparency, and input-fidelity controls are not offered.
- Generation uses `quality: medium`, `n: 1`, explicit dimensions, and Pollinations-supported request fields rather than OpenAI-only defaults.
- Local collection in IndexedDB: download, favorite, search, delete, clear, and reuse prompts/settings.
- Image input uploads use multipart; temporary server files are deleted after each completed request. Reference files left after abnormal shutdowns should be cleaned by the operator.
- User prompts, generated descriptions, model IDs, and API values are **not** translated when changing UI language.

### Optional custom-provider mode

The earlier OpenAI/compatible-provider features remain available **only when the operator explicitly sets** `ENABLE_CUSTOM_PROVIDERS=true`. Access them from the sign-in dialog's Advanced section. This mode uses a user-supplied key kept in page memory, independently of the Pollinations session. It is disabled by default in the public edition.

Optional `ALLOWED_API_HOSTS` restricts those destinations. Public HTTPS only, private/reserved IP filtering, pinned DNS results, no redirects, and an endpoint allowlist protect the forwarding path. This does not replace a full production security review.

## Deploy with Docker

```bash
cp .env.example .env
# Fill the required values and optional source/contact links.
docker compose up -d --build
```

The compose file binds to `127.0.0.1:3000` for use behind an HTTPS reverse proxy. It runs as a non-root user, with a read-only root filesystem and temporary upload space in `/tmp`. See [docs/nginx.example.conf](docs/nginx.example.conf) for a **template** that needs your hostname and certificate paths.

- `/healthz` is an unauthenticated health check; it does not prove OAuth or billing readiness.
- For exactly one trusted reverse proxy, set `TRUST_PROXY_HOPS=1` and ensure that proxy overwrites forwarding headers. Do not trust arbitrary public `X-Forwarded-For` headers.
- Allow long image requests; disable response buffering when using optional OpenAI SSE.
- Align upload-size limits at the proxy and application. The sample proxy caps requests at 200 MB; individual application files are capped at 50 MB, at most 17 files.
- Do not log OAuth callback queries, Cookie/Authorization headers, request bodies, or private credentials in your CDN, hosting layer, WAF, or proxy.
- Application metadata and session/wallet endpoints use `Cache-Control: no-store`.
- Production gets CSP and security headers. A configured public deployment is not intended to be embedded in third-party iframes; test OAuth in a standalone browser tab.
- Before heavy public traffic, add infrastructure-wide rate/size limits and monitoring. Current application limits include 3 concurrent image/API requests per IP, 10 sign-in starts per 10 minutes per IP, 2,000 expiring server sessions, and a 10-minute image-request deadline.

## Configuration

| Variable                   | Purpose                                                                         |
| -------------------------- | ------------------------------------------------------------------------------- |
| `PUBLIC_APP_URL`           | Public HTTPS root origin; determines the exact registered callback              |
| `POLLINATIONS_APP_KEY`     | Your public `pk_` OAuth App Key; `sk_` values are rejected                      |
| `POLLINATIONS_BUDGET`      | Suggested consent cap, defaults to 1 Pollen; user confirmation is authoritative |
| `POLLINATIONS_EXPIRY_DAYS` | Suggested authorization lifetime, defaults to 7 days                            |
| `PUBLIC_SOURCE_URL`        | Optional real public repository link                                            |
| `PUBLIC_CONTACT_URL`       | Optional operator HTTPS or mailto contact link; recommended before launch       |
| `ENABLE_CUSTOM_PROVIDERS`  | Off by default; enables independent developer/custom-provider mode              |
| `ALLOWED_API_HOSTS`        | Optional allowlist for the custom-provider forwarding path                      |
| `TRUST_PROXY_HOPS`         | Exact trusted proxy hop count, defaults to 0                                    |
| `PORT`                     | Listening port, defaults to 3000                                                |

Developer earnings are controlled by the App Key in Pollinations' dashboard, not by this code. If you opt in, verify and disclose the current platform markup. Do not present this app as free when it spends users' Pollen.

## Release checks

Run `npm run check:release` after setting your environment. Add `-- --live` to check public routes without logging in or spending Pollen. Missing domain/App Key produces a failing status by design. This is not a substitute for real OAuth and generation acceptance testing.

## Tests

```bash
npm test
# 33 unit/integration tests, including server-side OAuth fixtures

# With the site running on localhost:3000:
npx playwright install --with-deps chromium
node tests/publication-browser.mjs
node tests/browser.mjs
node tests/pollinations-browser.mjs
node tests/language-browser.mjs
```

Browser tests mock paid calls and authenticated UI states. OAuth server tests inject a mock discovery/token service; they cover state, PKCE, cookies, code reuse, consent denial, failed token exchange, sessions, and logout. The historical custom-provider tests explicitly mock an operator-enabled configuration.

**Verified on the live deployment:** Docker production build, HTTPS reverse proxy behind Cloudflare, `/healthz`, `/api/app` reporting `authReady: true`, the public model catalog, and a correctly formed authorization redirect for the registered callback.

**Not yet verified with a real account:** completing the OAuth consent step in a browser, actual paid generation/editing, provider-side revocation, and behavior under sustained traffic. These need a real user session and remain on the release checklist.

## Structure

```text
README.md                    Default English documentation
README.zh-CN.md              Simplified Chinese documentation
server.js                    Express proxy and production hosting
server/pollinations.js       OAuth, server sessions, fixed catalog/balance endpoints
src/main.jsx                Workspace, masks, collection, language control
src/api.js                  OpenAI and Pollinations payloads, SSE, local storage
src/usePollinations.js       Browser-side account/catalog state; no delegated token
src/Publication.jsx         Consent, balance, privacy, terms
src/i18n.js + locales.json   English/Chinese UI copy and preference
Dockerfile + compose.yml    Single-instance deployment templates
.env.example                Configuration names; no real secrets
```

## Sources and assets

Requirements reviewed on **2026-09-19**:

- [Official app-submission template](https://github.com/pollinations/pollinations/blob/main/.github/ISSUE_TEMPLATE/app-submission.yml)
- [Official BYOP / Connect User Wallets guide](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md)
- [Official API docs](https://github.com/pollinations/pollinations/blob/main/APIDOCS.md)
- [OAuth discovery](https://enter.pollinations.ai/.well-known/oauth-authorization-server)

The code uses React, Vite, Express, and lucide-react. Assets are local; no font/image CDN is required to render the workspace. Ceramic imagery is a generated inspiration example, not a live API result. Other inspiration photos are from Unsplash:

- https://images.unsplash.com/photo-1509316785289-025f5b846b35
- https://images.unsplash.com/photo-1600210492486-724fe5c67fb0
- https://images.unsplash.com/photo-1473116763249-2faaef81ccda

Code is ISC-licensed; third-party dependencies and photographs retain their respective licenses/terms. Pollinations' name is used for accurate attribution, not a claim of ownership or endorsement.
