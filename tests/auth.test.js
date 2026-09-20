import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import {
  installPollinations,
  SessionStore,
  publicationConfig,
  pkceChallenge,
  normalizeCatalog,
  ISSUER,
  API,
} from '../server/pollinations.js';
const env = { PUBLIC_APP_URL: 'https://atelier.example', POLLINATIONS_APP_KEY: 'pk_test_fixture' };
const sampleModels = [
  { name: 'text-model', output_modalities: ['text'] },
  {
    name: 'image-only',
    title: 'Image Only',
    output_modalities: ['image'],
    input_modalities: ['text'],
    supported_endpoints: ['/v1/images/generations', '/v1/images/edits'],
  },
  {
    name: 'editing',
    output_modalities: ['image'],
    input_modalities: ['text', 'image'],
    supported_endpoints: ['/v1/images/generations', '/v1/images/edits'],
    max_reference_images: 8,
    resolutions: ['1k', '2k'],
  },
];
async function fixture(overrides = {}) {
  const calls = [];
  let exchanged;
  const fakeFetch = async (url, options = {}) => {
    calls.push(String(url));
    if (String(url).includes('.well-known'))
      return Response.json({
        issuer: ISSUER,
        authorization_endpoint: ISSUER + '/authorize',
        token_endpoint: overrides.endpoint || ISSUER + '/api/oauth/token',
        code_challenge_methods_supported: ['S256'],
      });
    if (String(url) === ISSUER + '/api/oauth/token') {
      exchanged = new URLSearchParams(options.body);
      if (overrides.failExchange) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      return Response.json({
        access_token: 'sk_scoped_fixture',
        token_type: 'bearer',
        expires_in: 604800,
        scope: '',
      });
    }
    if (String(url) === API + '/image/models') return Response.json(sampleModels);
    if (String(url) === API + '/account/balance') {
      assert.equal(options.headers.Authorization, 'Bearer sk_scoped_fixture');
      return Response.json({ balance: 0.95, accountBalance: { total: 999 } });
    }
    throw new Error('Unexpected external call: ' + url);
  };
  const app = express();
  const auth = installPollinations(app, { env: overrides.env || env, fetchImpl: fakeFetch });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = (path, opts = {}) => fetch(base + path, { redirect: 'manual', ...opts });
  const start = () =>
    request('/auth/start', {
      method: 'POST',
      headers: { Origin: env.PUBLIC_APP_URL, 'x-atelier-request': '1' },
    });
  const cookie = (r) => r.headers.getSetCookie().at(-1)?.split(';')[0];
  const close = async () => {
    auth.close();
    await new Promise((resolve) => server.close(resolve));
  };
  return {
    request,
    start,
    cookie,
    close,
    calls,
    base,
    get exchanged() {
      return exchanged;
    },
  };
}
test('Publication config rejects secret keys and unsafe callback URLs', () => {
  assert.throws(
    () => publicationConfig({ ...env, POLLINATIONS_APP_KEY: 'sk_do_not_publish' }),
    /public pk_/,
  );
  for (const url of [
    'http://example.com',
    'https://x.com/path',
    'https://user:password@x.com',
    'https://x.com/?x=1',
  ])
    assert.throws(() => publicationConfig({ ...env, PUBLIC_APP_URL: url }));
  assert.equal(publicationConfig({}).ready, false);
  assert.equal(
    publicationConfig({ ...env, PUBLIC_APP_URL: 'http://localhost:3000' }).redirectUri,
    'http://localhost:3000/auth/callback',
  );
});
test('PKCE matches RFC 7636 test vector', () =>
  assert.equal(
    pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  ));
test('Session storage expires tokens, caps capacity, and deletes credentials', () => {
  let now = 0;
  const store = new SessionStore({ now: () => now, capacity: 1 });
  const id = store.create({ token: 'sk_fixture' }, 10);
  assert.equal(store.get(id).token, 'sk_fixture');
  assert.throws(() => store.create({}), /capacity/);
  now = 11;
  assert.equal(store.get(id), null);
  const next = store.create({ token: 'x' }, 10);
  store.delete(next);
  assert.equal(store.get(next), null);
});
test('Catalog capabilities require image input as well as an edit endpoint', () => {
  const models = normalizeCatalog(sampleModels);
  assert.equal(models.length, 2);
  assert.equal(models[0].canEdit, false);
  assert.equal(models[1].canEdit, true);
  assert.equal(models[1].maxReferences, 8);
  assert.deepEqual(models[1].resolutions, ['1k', '2k']);
});
test('Unconfigured publication has no fake login and no key exposure', async () => {
  const f = await fixture({ env: {} });
  try {
    const info = await (await f.request('/api/app')).json();
    assert.equal(info.authReady, false);
    assert.deepEqual(info.missing, ['PUBLIC_APP_URL', 'POLLINATIONS_APP_KEY']);
    const r = await f.request('/auth/start', {
      method: 'POST',
      headers: { Origin: f.base, 'x-atelier-request': '1' },
    });
    assert.equal(r.status, 503);
    assert.equal(f.calls.length, 0);
  } finally {
    await f.close();
  }
});
test('OAuth code flow: state, PKCE, secure cookie, scoped server token, balance and logout', async () => {
  const f = await fixture();
  try {
    const start = await f.start();
    assert.equal(start.status, 200);
    const auth = new URL((await start.json()).url);
    assert.equal(auth.origin, ISSUER);
    assert.equal(auth.searchParams.get('client_id'), 'pk_test_fixture');
    assert.equal(auth.searchParams.get('redirect_uri'), env.PUBLIC_APP_URL + '/auth/callback');
    assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(auth.searchParams.get('scope'), '');
    assert.equal(auth.searchParams.get('budget'), '1');
    const pendingCookie = f.cookie(start);
    assert.match(start.headers.get('set-cookie'), /HttpOnly/);
    assert.match(start.headers.get('set-cookie'), /Secure/);
    assert.match(start.headers.get('set-cookie'), /SameSite=Lax/);
    const callback = await f.request(
      '/auth/callback?code=single-use-code&state=' + auth.searchParams.get('state'),
      { headers: { Cookie: pendingCookie } },
    );
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get('location'), '/?auth=connected');
    assert.equal(f.exchanged.get('code'), 'single-use-code');
    assert.equal(f.exchanged.get('redirect_uri'), env.PUBLIC_APP_URL + '/auth/callback');
    assert.equal(
      pkceChallenge(f.exchanged.get('code_verifier')),
      auth.searchParams.get('code_challenge'),
    );
    const userCookie = f.cookie(callback);
    assert.notEqual(userCookie, pendingCookie);
    assert.ok(!userCookie.includes('sk_'));
    const session = await (
      await f.request('/api/session', { headers: { Cookie: userCookie } })
    ).json();
    assert.equal(session.authenticated, true);
    assert.ok(!JSON.stringify(session).includes('sk_scoped_fixture'));
    const wallet = await (
      await f.request('/api/wallet', { headers: { Cookie: userCookie } })
    ).json();
    assert.deepEqual(wallet, { balance: 0.95 });
    const replay = await f.request(
      '/auth/callback?code=single-use-code&state=' + auth.searchParams.get('state'),
      { headers: { Cookie: pendingCookie } },
    );
    assert.equal(replay.headers.get('location'), '/?auth=state_error');
    const foreign = await f.request('/auth/logout', {
      method: 'POST',
      headers: { Cookie: userCookie, Origin: 'https://evil.example', 'x-atelier-request': '1' },
    });
    assert.equal(foreign.status, 403);
    const logout = await f.request('/auth/logout', {
      method: 'POST',
      headers: { Cookie: userCookie, Origin: env.PUBLIC_APP_URL, 'x-atelier-request': '1' },
    });
    assert.equal(logout.status, 200);
    assert.equal(
      (await (await f.request('/api/session', { headers: { Cookie: userCookie } })).json())
        .authenticated,
      false,
    );
    assert.equal((await f.request('/api/wallet', { headers: { Cookie: userCookie } })).status, 401);
  } finally {
    await f.close();
  }
});
test('Mismatched state and user denial do not exchange a token', async () => {
  const f = await fixture();
  try {
    const start = await f.start(),
      url = new URL((await start.json()).url),
      cookie = f.cookie(start);
    const mismatch = await f.request('/auth/callback?code=code&state=wrong', {
      headers: { Cookie: cookie },
    });
    assert.equal(mismatch.headers.get('location'), '/?auth=state_error');
    const denied = await f.request(
      '/auth/callback?error=access_denied&state=' + url.searchParams.get('state'),
      { headers: { Cookie: cookie } },
    );
    assert.equal(denied.headers.get('location'), '/?auth=denied');
    assert.equal(f.exchanged, undefined);
  } finally {
    await f.close();
  }
});
test('OAuth discovery cannot redirect token exchange to another host', async () => {
  const f = await fixture({ endpoint: 'https://evil.example/token' });
  try {
    const start = await f.start();
    assert.equal(start.status, 503);
    assert.equal(f.calls.length, 1);
  } finally {
    await f.close();
  }
});
test('OAuth exchange error is sanitized and consumes the pending state', async () => {
  const f = await fixture({ failExchange: true });
  try {
    const start = await f.start(),
      url = new URL((await start.json()).url),
      cookie = f.cookie(start);
    const response = await f.request(
      '/auth/callback?code=secret-code&state=' + url.searchParams.get('state'),
      { headers: { Cookie: cookie } },
    );
    assert.equal(response.headers.get('location'), '/?auth=exchange_error');
    assert.ok(!JSON.stringify([...response.headers]).includes('secret-code'));
    assert.equal(
      (await (await f.request('/api/session', { headers: { Cookie: cookie } })).json())
        .authenticated,
      false,
    );
  } finally {
    await f.close();
  }
});
