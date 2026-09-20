import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { fetch as defaultFetch } from 'undici';

export const ISSUER = 'https://enter.pollinations.ai';
export const API = 'https://gen.pollinations.ai';
const COOKIE = 'atelier_pollen';
const PENDING_MS = 10 * 60 * 1000;
const SESSION_MS = 12 * 60 * 60 * 1000;
const random = () => randomBytes(32).toString('base64url');
export function pkceChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}
function equal(a, b) {
  return (
    typeof a === 'string' &&
    typeof b === 'string' &&
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export function publicationConfig(env = process.env) {
  let origin = '';
  if (env.PUBLIC_APP_URL) {
    const url = new URL(env.PUBLIC_APP_URL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error(
        'PUBLIC_APP_URL must be an HTTPS origin (HTTP loopback is allowed for local tests).',
      );
    origin = url.origin;
  }
  const clientId = env.POLLINATIONS_APP_KEY || '';
  if (clientId && !/^pk_[A-Za-z0-9_-]+$/.test(clientId))
    throw new Error('POLLINATIONS_APP_KEY must be a public pk_ App Key, never an sk_ secret.');
  const budget = Number(env.POLLINATIONS_BUDGET || 1);
  const expiryDays = Number(env.POLLINATIONS_EXPIRY_DAYS || 7);
  if (!Number.isFinite(budget) || budget <= 0 || budget > 100)
    throw new Error('POLLINATIONS_BUDGET must be between 0 and 100 (exclusive of zero).');
  if (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 30)
    throw new Error('POLLINATIONS_EXPIRY_DAYS must be between 1 and 30.');
  const publicLink = (value) => {
    if (!value) return '';
    const u = new URL(value);
    if (!['https:', 'mailto:'].includes(u.protocol) || u.username || u.password)
      throw new Error('Public links must use HTTPS or mailto.');
    return u.href;
  };
  return {
    origin,
    clientId,
    redirectUri: origin ? origin + '/auth/callback' : '',
    ready: !!(origin && clientId),
    budget,
    expiryDays,
    allowCustomProviders: env.ENABLE_CUSTOM_PROVIDERS === 'true',
    sourceUrl: publicLink(env.PUBLIC_SOURCE_URL),
    contactUrl: publicLink(env.PUBLIC_CONTACT_URL),
  };
}
export class SessionStore {
  constructor({ now = Date.now, capacity = 2000 } = {}) {
    this.now = now;
    this.capacity = capacity;
    this.items = new Map();
  }
  sweep() {
    for (const [id, data] of this.items) if (data.expiresAt <= this.now()) this.items.delete(id);
  }
  create(data, life = PENDING_MS) {
    this.sweep();
    if (this.items.size >= this.capacity)
      throw new Error('Session capacity reached. Try again later.');
    const id = random();
    this.items.set(id, { ...data, expiresAt: this.now() + life });
    return id;
  }
  get(id) {
    const value = this.items.get(id);
    if (!value || value.expiresAt <= this.now()) {
      this.items.delete(id);
      return null;
    }
    return value;
  }
  delete(id) {
    this.items.delete(id);
  }
}
export function normalizeCatalog(payload) {
  const rows = Array.isArray(payload) ? payload : payload.data;
  if (!Array.isArray(rows)) throw new Error('Invalid model catalog response.');
  return rows
    .filter(
      (row) =>
        (row.output_modalities || []).includes('image') &&
        (row.supported_endpoints || []).includes('/v1/images/generations'),
    )
    .map((row) => ({
      id: row.name || row.id,
      title: row.title || row.name || row.id,
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
      canEdit:
        (row.input_modalities || []).includes('image') &&
        (row.supported_endpoints || []).includes('/v1/images/edits'),
      maxReferences: Number.isInteger(row.max_reference_images)
        ? Math.min(16, row.max_reference_images)
        : null,
      resolutions: Array.isArray(row.resolutions)
        ? row.resolutions.filter((v) => typeof v === 'string')
        : [],
      paidOnly: row.paid_only === true,
    }))
    .filter((row) => typeof row.id === 'string');
}
export function installPollinations(
  app,
  { env = process.env, fetchImpl = defaultFetch, store = new SessionStore() } = {},
) {
  const config = publicationConfig(env);
  const secure = config.origin.startsWith('https:');
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
  let discoveryCache,
    catalogCache,
    catalogAt = 0;
  const rate = new Map();
  const timer = setInterval(() => {
    store.sweep();
    const now = Date.now();
    for (const [ip, info] of rate) if (info.reset <= now) rate.delete(ip);
  }, 60000);
  timer.unref();
  const idFrom = (req) => {
    const raw = (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(COOKIE + '='));
    return raw?.slice(COOKIE.length + 1) || '';
  };
  const getSession = (req) => store.get(idFrom(req));
  const noStore = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
  app.use('/auth', noStore);
  app.use('/api/session', noStore);
  app.use('/api/wallet', noStore);
  const mutationGuard = (req, res, next) => {
    let expected;
    try {
      expected = config.origin || new URL('http://' + req.headers.host).origin;
      const origin = req.headers.origin;
      const validOrigin =
        origin && (config.origin ? origin === expected : new URL(origin).host === req.headers.host);
      if (
        !validOrigin ||
        req.headers['x-atelier-request'] !== '1' ||
        req.headers['sec-fetch-site'] === 'cross-site'
      )
        return res
          .status(403)
          .json({ error: { message: 'Invalid request origin. Reload this app and try again.' } });
    } catch {
      return res.status(403).json({ error: { message: 'Invalid request origin.' } });
    }
    next();
  };
  async function discovery() {
    if (discoveryCache) return discoveryCache;
    const res = await fetchImpl(ISSUER + '/.well-known/oauth-authorization-server', {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!res.ok) throw new Error('Pollinations authorization discovery is unavailable.');
    const data = await res.json();
    if (data.issuer !== ISSUER || !data.code_challenge_methods_supported?.includes('S256'))
      throw new Error('Unexpected authorization server metadata.');
    for (const name of ['authorization_endpoint', 'token_endpoint']) {
      const u = new URL(data[name]);
      if (u.origin !== ISSUER || u.username || u.password || u.hash)
        throw new Error('Untrusted authorization endpoint.');
    }
    discoveryCache = data;
    return data;
  }
  async function catalog(force = false) {
    if (!force && catalogCache && Date.now() - catalogAt < 300000) return catalogCache;
    const res = await fetchImpl(API + '/image/models', {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!res.ok) throw new Error('The Pollinations model catalog is unavailable. Please retry.');
    const models = normalizeCatalog(await res.json());
    if (!models.length) throw new Error('No image models are available in the catalog.');
    catalogCache = models;
    catalogAt = Date.now();
    return models;
  }
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/app', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      name: 'Atelier',
      authReady: config.ready,
      redirectUri: config.redirectUri,
      missing: [
        ...(!config.origin ? ['PUBLIC_APP_URL'] : []),
        ...(!config.clientId ? ['POLLINATIONS_APP_KEY'] : []),
      ],
      budget: config.budget,
      expiryDays: config.expiryDays,
      sessionHours: SESSION_MS / 3600000,
      allowCustomProviders: config.allowCustomProviders,
      sourceUrl: config.sourceUrl,
      contactUrl: config.contactUrl,
    });
  });
  app.get('/api/session', (req, res) => {
    const session = getSession(req);
    res.json({
      authenticated: !!session?.token,
      expiresAt: session?.token ? session.expiresAt : null,
    });
  });
  app.get('/api/catalog', async (req, res) => {
    try {
      res.json({ models: await catalog(), fetchedAt: catalogAt });
    } catch (e) {
      res.status(503).json({ error: { message: e.message } });
    }
  });
  app.get('/api/wallet', async (req, res) => {
    const session = getSession(req);
    if (!session?.token)
      return res.status(401).json({ error: { message: 'Sign in with Pollinations to continue.' } });
    try {
      const upstream = await fetchImpl(API + '/account/balance', {
        headers: { Authorization: 'Bearer ' + session.token },
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      if (!upstream.ok)
        return res.status(upstream.status).json({
          error: {
            message:
              upstream.status === 403
                ? 'Balance access was not granted. Generation may still be available.'
                : 'Unable to read your authorized balance. Reconnect if your authorization has expired.',
          },
        });
      const data = await upstream.json();
      const balance = Number(data.balance);
      res.json({
        balance:
          data.balance !== null && data.balance !== undefined && Number.isFinite(balance)
            ? balance
            : null,
      });
    } catch {
      res.status(502).json({ error: { message: 'Unable to read the balance. Please retry.' } });
    }
  });
  app.post('/auth/start', mutationGuard, async (req, res) => {
    if (!config.ready)
      return res.status(503).json({
        error: {
          message:
            'Sign-in is not configured for this deployment. The operator must register an App Key and callback URL.',
        },
      });
    const ip = req.ip;
    const now = Date.now();
    let limit = rate.get(ip);
    if (!limit || limit.reset <= now) {
      limit = { count: 0, reset: now + 600000 };
      rate.set(ip, limit);
    }
    if (++limit.count > 10)
      return res
        .status(429)
        .json({ error: { message: 'Too many sign-in attempts. Try again in 10 minutes.' } });
    try {
      const metadata = await discovery();
      const verifier = random(),
        state = random();
      const previous = idFrom(req);
      store.delete(previous);
      const id = store.create({ verifier, state });
      res.cookie(COOKIE, id, { ...cookieOptions, maxAge: PENDING_MS });
      const url = new URL(metadata.authorization_endpoint);
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: '',
        state,
        code_challenge: pkceChallenge(verifier),
        code_challenge_method: 'S256',
        budget: String(config.budget),
        expiry: String(config.expiryDays),
      }).toString();
      res.json({ url: url.toString() });
    } catch (e) {
      res.status(503).json({ error: { message: e.message } });
    }
  });
  app.get('/auth/callback', async (req, res) => {
    const id = idFrom(req),
      session = getSession(req);
    if (!session?.state || !equal(req.query.state, session.state))
      return res.redirect(303, '/?auth=state_error');
    // Single-use state, consumed before any external request. Never log the code or token.
    store.delete(id);
    res.clearCookie(COOKIE, cookieOptions);
    if (req.query.error) return res.redirect(303, '/?auth=denied');
    if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 4096)
      return res.redirect(303, '/?auth=invalid_code');
    try {
      const metadata = await discovery();
      const response = await fetchImpl(metadata.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: req.query.code,
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          code_verifier: session.verifier,
        }),
        signal: AbortSignal.timeout(20000),
        redirect: 'error',
      });
      if (!response.ok) return res.redirect(303, '/?auth=exchange_error');
      const token = await response.json();
      if (typeof token.access_token !== 'string' || !/^sk_[A-Za-z0-9_-]+$/.test(token.access_token))
        return res.redirect(303, '/?auth=exchange_error');
      const ttl = Math.min(SESSION_MS, Number(token.expires_in) * 1000);
      if (!Number.isFinite(ttl) || ttl <= 0) return res.redirect(303, '/?auth=exchange_error');
      const newId = store.create(
        { token: token.access_token, scope: typeof token.scope === 'string' ? token.scope : '' },
        ttl,
      );
      res.cookie(COOKIE, newId, { ...cookieOptions, maxAge: ttl });
      return res.redirect(303, '/?auth=connected');
    } catch {
      return res.redirect(303, '/?auth=exchange_error');
    }
  });
  app.post('/auth/logout', mutationGuard, (req, res) => {
    store.delete(idFrom(req));
    res.clearCookie(COOKIE, cookieOptions);
    res.json({ ok: true });
  });
  return {
    config,
    getSession,
    invalidateSession: (req) => store.delete(idFrom(req)),
    mutationGuard,
    catalog,
    close: () => clearInterval(timer),
  };
}
