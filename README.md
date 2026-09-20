# Atelier — Pollinations Image Studio

**English** | [简体中文](README.zh-CN.md)

**Live:** <https://image.xt1171.eu.org> · **License:** ISC

A quiet, bilingual image studio built on [Pollinations](https://pollinations.ai). Write a prompt, generate an image, refine it with reference images, and keep a private collection in your browser.

Sign-in goes through Pollinations' **Bring Your Own Pollen** flow. Users authorize their own account, approve a spending cap, and generation is billed to their own Pollen balance — the operator never holds an API key and never pays for other people's generations.

## Features

- **Prompt to image** using the live Pollinations image-model catalog (fetched server-side from `/image/models`, cached for 5 minutes).
- **Reference-image editing** for models that advertise image input and the edit endpoint. Published reference limits are enforced again on the backend.
- **Local collection** in IndexedDB: download, favorite, search, delete, clear, reuse prompt and settings.
- **Bilingual UI** — English by default, 简体中文 from the language menu. Prompts, model IDs and API values are never translated.
- **BYOP sign-in** using the OAuth authorization-code flow with PKCE S256.
- **Cost disclosure** — suggested budget, authorization lifetime, model pricing links, and Pollinations attribution in the header and footer.
- `/privacy` and `/terms` pages in both languages.

## Requirements

- Node.js **20.19+** (22 LTS recommended)
- Docker + Docker Compose, for the container deployment path
- A permanent **HTTPS** origin if you want working sign-in — OAuth callbacks are rejected over plain HTTP, except on loopback for local tests

## Quick start (development)

```bash
npm ci
cp .env.example .env
npm run dev
# http://localhost:3000
```

Without an App Key the workspace, inspiration gallery, live model catalog, local collection, language switch and legal pages all still render. The sign-in dialog explains exactly which variables are missing; nothing is faked.

Production build without Docker:

```bash
npm ci
npm run build
npm start
```

The server binds `0.0.0.0:$PORT` (default 3000) and serves the built frontend and the API from the same origin. This is a long-running Node service — it is **not** a static site and cannot be hosted on GitHub Pages alone.

## Configure sign-in (BYOP App Key)

1. Deploy the app to a permanent HTTPS origin, for example `https://atelier.example.com`.
2. Create a **public App Key** at <https://enter.pollinations.ai/keys>. It has a `pk_` prefix and acts as the OAuth client ID — it is **not** a bearer key for generating images. (An `sk_` key is rejected by the app.)
3. Register the exact callback URL: `https://atelier.example.com/auth/callback`. It must match character for character.
4. Fill in the environment variables and restart:

```dotenv
PUBLIC_APP_URL=https://atelier.example.com
POLLINATIONS_APP_KEY=pk_your_public_app_key
POLLINATIONS_BUDGET=1
POLLINATIONS_EXPIRY_DAYS=7
ENABLE_CUSTOM_PROVIDERS=false
TRUST_PROXY_HOPS=0
PORT=3000
```

`PUBLIC_APP_URL` must be a root origin — no path, query or fragment. HTTP is accepted only for a loopback origin such as `http://127.0.0.1:3000`, which is useful when testing the callback locally.

App Key settings are fixed once created: to change the callback URL or the name, revoke the key and create a new one.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PUBLIC_APP_URL` | Public HTTPS root origin. Determines the callback you must register |
| `POLLINATIONS_APP_KEY` | Public `pk_` App Key (OAuth client ID). `sk_` values are rejected |
| `POLLINATIONS_BUDGET` | Suggested consent cap in Pollen, default `1`. The user's confirmation on the consent page is authoritative |
| `POLLINATIONS_EXPIRY_DAYS` | Suggested authorization lifetime in days, default `7` (1–30) |
| `PUBLIC_SOURCE_URL` | Optional link to your public repository, shown in the footer |
| `PUBLIC_CONTACT_URL` | Optional `https://` or `mailto:` contact link |
| `ENABLE_CUSTOM_PROVIDERS` | Default `false`. Enables the independent OpenAI-compatible provider mode |
| `ALLOWED_API_HOSTS` | Optional host allowlist for the custom-provider forwarding path |
| `TRUST_PROXY_HOPS` | Number of trusted proxy hops, default `0`. Set to `1` only behind exactly one proxy that overwrites forwarding headers |
| `PORT` | Listening port, default `3000` |

Developer earnings, if any, are configured on the App Key inside the Pollinations dashboard — this code does not control them.

## Deploy with Docker

```bash
cp .env.example .env
# fill PUBLIC_APP_URL and POLLINATIONS_APP_KEY
docker compose up -d --build
```

The compose file publishes `127.0.0.1:3000` so it can sit behind a TLS reverse proxy. It runs as a non-root user with a read-only root filesystem, `cap_drop: ALL`, `no-new-privileges`, and a 2 GB tmpfs for uploads.

If port 3000 is already taken on the host, change the left-hand side of the mapping (`"127.0.0.1:3100:3000"`) and point the proxy at the new port.

```bash
docker compose logs -f    # "Atelier is listening on 0.0.0.0:3000"
docker compose down
```

## Put it behind a reverse proxy

Start from [docs/nginx.example.conf](docs/nginx.example.conf) and replace the hostname and certificate paths. The parts that matter:

- Proxy to `http://127.0.0.1:3000`, set `X-Forwarded-For $remote_addr` (overwrite, do not append) and `X-Forwarded-Proto $scheme`.
- Turn buffering off (`proxy_buffering off`, `proxy_request_buffering off`) and allow long requests (`proxy_read_timeout 620s`).
- Do **not** log OAuth callback query strings, `Cookie`/`Authorization` headers, or request bodies — the callback carries a single-use code. The nginx template uses `access_log off; error_log /dev/null crit;` for that reason.
- Match upload limits across layers: the sample proxy allows 200 MB per request; the app caps each file at 50 MB and 17 files per request.
- If and only if there is exactly one trusted proxy, set `TRUST_PROXY_HOPS=1`. Never trust arbitrary public `X-Forwarded-For` headers.

### Cloudflare (or any CDN) notes

- Point the hostname at the origin and let the CDN terminate TLS; set the SSL mode to **Flexible** if the origin listens on port 80. With **Full / Full (strict)** the CDN connects to origin port **443**, which fails on a host that already runs something else there.
- Keep `/api/*`, `/auth/*`, `/api/session` and `/api/wallet` out of any cache. The app already sends `Cache-Control: no-store` on those routes; make sure the CDN respects it.
- Test OAuth in a standalone browser tab. The app sends `frame-ancestors 'self'`, so it is not meant to be embedded in third-party iframes.

## Health check and operations

- `GET /healthz` → `{"status":"ok"}`. Unauthenticated, and it does **not** prove OAuth or billing readiness.
- `GET /api/app` → `authReady`, `redirectUri`, `missing`, `budget`, `expiryDays`, `sessionHours`. The fastest way to see whether your configuration is complete.
- Sessions are held in server memory: restarting the container signs everyone out. This is intentionally a **single-instance** design; multiple replicas need a properly secured shared session store.
- App-level limits: 3 concurrent image/API requests per IP, 10 sign-in starts per 10 minutes per IP, 2000 automatically expiring sessions, 10-minute image request deadline. Add infrastructure-level limits before running heavy public traffic.

## How the sign-in flow works

1. The browser asks the backend to start a sign-in. The backend generates a PKCE verifier plus a single-use `state`, stores them in server memory, and returns the authorization URL.
2. The user approves a spending cap on the Pollinations consent page.
3. Pollinations redirects to `/auth/callback?code=…&state=…`. The backend verifies `state`, consumes it immediately, and exchanges the code for a token **server-side**, using PKCE.
4. The delegated `sk_` token stays in server memory only. The browser receives a random `HttpOnly`, `SameSite=Lax` session cookie (`Secure` on an HTTPS origin) and never sees the token.
5. Session-authenticated generation requests are pinned to `https://gen.pollinations.ai`; a session cannot redirect the delegated credential to another host.
6. Sessions last at most 12 hours or until the token expires. Disconnecting deletes the local session — it does **not** revoke the key in the provider dashboard, so the UI links to the official revocation page.

No refresh tokens, no automatic retries of billable generation calls, and no profile / account-admin / usage scopes are requested.

## Optional custom-provider mode

The OpenAI-compatible provider features are available only when you explicitly set `ENABLE_CUSTOM_PROVIDERS=true`. They are reachable from the Advanced section of the sign-in dialog and use a user-supplied key kept in page memory, independent of the Pollinations session. `ALLOWED_API_HOSTS` restricts the destinations. Public HTTPS only, private/reserved IP filtering, pinned DNS results, no redirects, and an endpoint allowlist guard the forwarding path — still not a substitute for a full security review.

## Tests

```bash
npm test
# 33 unit/integration tests, including server-side OAuth fixtures

# with the site running on localhost:3000
npx playwright install --with-deps chromium
node tests/publication-browser.mjs
node tests/browser.mjs
node tests/pollinations-browser.mjs
node tests/language-browser.mjs
```

Browser tests mock paid calls and authenticated UI states. Server-side OAuth tests inject a mock discovery/token service and cover state, PKCE, cookies, code replay, consent denial, failed token exchange, sessions and logout. `npm run check:release` verifies the configuration and, with `-- --live`, the public routes.

## Project structure

```text
server.js                    Express proxy, API guard, production hosting
server/pollinations.js       OAuth, server sessions, fixed catalog/balance endpoints
src/main.jsx                 Workspace, masks, collection, language controls
src/api.js                   Request payloads, SSE, local storage
src/usePollinations.js       Browser-side account/catalog state (never sees the token)
src/Publication.jsx          Consent, balance, privacy, terms
src/i18n.js + locales.json   English/Chinese UI copy and preference
Dockerfile + compose.yml     Single-instance deployment
docs/nginx.example.conf      Reverse-proxy template (replace hostname and certs)
```

## References

- [Pollinations API docs](https://github.com/pollinations/pollinations/blob/main/APIDOCS.md)
- [BYOP / Connect user wallets](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md)
- [OAuth discovery document](https://enter.pollinations.ai/.well-known/oauth-authorization-server)

## Assets and license

The UI uses React, Vite, Express and lucide-react. Interface assets are local; rendering the workspace requires no external font or image CDN. Ceramic imagery is a generated inspiration example, not a live API result. Other inspiration photos come from Unsplash:

- https://images.unsplash.com/photo-1509316785289-025f5b846b35
- https://images.unsplash.com/photo-1600210492486-724fe5c67fb0
- https://images.unsplash.com/photo-1473116763249-2faaef81ccda

Code is **ISC**-licensed; third-party dependencies and photographs keep their own licenses. The Pollinations name is used for accurate attribution, not as a claim of ownership or endorsement.
