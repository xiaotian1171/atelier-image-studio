import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { installPollinations } from './server/pollinations.js';
import express from 'express';
import multer from 'multer';
import { mkdtemp, rm } from 'node:fs/promises';
import { openAsBlob } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent, fetch } from 'undici';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY_HOPS) {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(hops) || hops < 0 || hops > 3)
    throw new Error('TRUST_PROXY_HOPS must be 0–3.');
  app.set('trust proxy', hops);
}
let publication;
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" +
        (publication.config.origin ? "; frame-ancestors 'self'" : ''),
    );
  }
  next();
});
publication = installPollinations(app);
const upload = multer({
  dest: await mkdtemp(path.join(os.tmpdir(), 'atelier-')),
  limits: { fileSize: 50 * 1024 * 1024, files: 17, fields: 80, fieldSize: 1024 * 1024 },
});
const active = new Map();
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  try {
    if (
      origin &&
      (publication.config.origin
        ? origin !== publication.config.origin
        : new URL(origin).host !== req.headers.host)
    )
      return res.status(403).json({ error: { message: '不允许跨站请求' } });
  } catch {
    return res.status(403).json({ error: { message: '不允许跨站请求' } });
  }
  if (req.headers['x-auth-mode'] === 'pollinations') {
    if (
      req.headers['x-atelier-request'] !== '1' ||
      !origin ||
      req.headers['sec-fetch-site'] === 'cross-site'
    )
      return res
        .status(403)
        .json({ error: { message: 'Invalid request origin. Reload this app and try again.' } });
    if (!publication.getSession(req)?.token)
      return res.status(401).json({ error: { message: 'Sign in with Pollinations to continue.' } });
    const base = req.headers['x-base-url'];
    if (base && base !== 'https://gen.pollinations.ai/v1')
      return res.status(400).json({
        error: { message: 'Pollinations session tokens cannot be sent to another provider.' },
      });
  } else if (!publication.config.allowCustomProviders) {
    return res.status(401).json({ error: { message: 'Sign in with Pollinations to continue.' } });
  }
  const ip = req.ip;
  const n = active.get(ip) || 0;
  if (n >= 3) return res.status(429).json({ error: { message: '同时最多 3 个请求，请稍后重试' } });
  active.set(ip, n + 1);
  res.once('close', () => {
    const n = active.get(ip) || 1;
    if (n <= 1) active.delete(ip);
    else active.set(ip, n - 1);
  });
  next();
});
app.post('/api/:operation', express.json({ limit: '2mb' }), upload.any(), async (req, res) => {
  let dispatcher;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600000);
  res.once('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const op = req.params.operation;
    if (!['generations', 'edits', 'variations', 'models'].includes(op)) throw new Error('未知接口');
    const usingSession = req.headers['x-auth-mode'] === 'pollinations';
    const key = usingSession ? publication.getSession(req)?.token : req.headers['x-api-key'];
    if (!key || /[\r\n]/.test(key)) throw new Error('请先配置有效的 API Key');
    const base = new URL(
      usingSession
        ? 'https://gen.pollinations.ai/v1'
        : req.headers['x-base-url'] || 'https://api.openai.com/v1',
    );
    if (usingSession && op !== 'models') {
      const catalog = await publication.catalog();
      const model = catalog.find(
        (m) => m.id === req.body?.model || m.aliases.includes(req.body?.model),
      );
      const fail = (message) => res.status(400).json({ error: { message } });
      if (op === 'variations') return fail('Pollinations does not document a variations endpoint.');
      if (!model) return fail('Choose a model from the current Pollinations image catalog.');
      if (op === 'edits' && !model.canEdit)
        return fail('This model does not accept reference images.');
      if (Number(req.body.n ?? 1) !== 1)
        return fail('Pollinations currently supports one image per request.');
      if (!req.body.prompt?.trim() || req.body.prompt.length > 32000)
        return fail('Enter a prompt between 1 and 32,000 characters.');
      if ((req.files || []).some((f) => f.fieldname === 'mask'))
        return fail('Masks are not documented by this Pollinations endpoint.');
      if (op === 'edits' && (!req.files?.length || req.files.length > (model.maxReferences || 16)))
        return fail('The reference image count exceeds this model’s supported range.');
    }
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash)
      throw new Error('Base URL 必须是无查询参数的 HTTPS 地址');
    const host = base.hostname.replace(/^\[|\]$/g, '');
    const allowed = (process.env.ALLOWED_API_HOSTS || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!usingSession && allowed.length && !allowed.includes(host))
      throw new Error('此部署不允许连接该 API 域名');
    const records = await dns.lookup(host, { all: true });
    if (!records.length || records.some((r) => ipaddr.process(r.address).range() !== 'unicast'))
      throw new Error('安全限制：不允许访问本机、内网或保留地址');
    dispatcher = new Agent({
      connect: {
        lookup: (hostname, options, cb) => {
          const r =
            records.find((r) => !options.family || r.family === options.family) || records[0];
          cb(null, options.all ? [r] : r.address, r.family);
        },
      },
      headersTimeout: 600000,
      bodyTimeout: 600000,
    });
    const endpoint =
      base.toString().replace(/\/$/, '') + (op === 'models' ? '/models' : '/images/' + op);
    let body;
    const headers = { Authorization: 'Bearer ' + key };
    if (!usingSession && req.headers['x-openai-organization'])
      headers['OpenAI-Organization'] = req.headers['x-openai-organization'];
    if (!usingSession && req.headers['x-openai-project'])
      headers['OpenAI-Project'] = req.headers['x-openai-project'];
    if (op !== 'models') {
      if (op === 'generations') {
        body = JSON.stringify(req.body);
        headers['Content-Type'] = 'application/json';
      } else {
        body = new FormData();
        for (const [k, v] of Object.entries(req.body || {})) body.append(k, String(v));
        for (const f of req.files || []) {
          if (!['image', 'image[]', 'mask'].includes(f.fieldname))
            throw new Error('不支持的文件字段');
          body.append(f.fieldname, await openAsBlob(f.path, { type: f.mimetype }), f.originalname);
        }
      }
    }
    const upstream = await fetch(endpoint, {
      method: op === 'models' ? 'GET' : 'POST',
      headers,
      body,
      dispatcher,
      signal: controller.signal,
      redirect: 'error',
    });
    if (usingSession && upstream.status === 401) publication.invalidateSession(req);
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    const id = upstream.headers.get('x-request-id');
    if (id) res.setHeader('x-request-id', id);
    if (usingSession && !upstream.ok) {
      const text = await upstream.text();
      res.send(text.replaceAll(key, '[redacted]'));
    } else if (upstream.body) await pipeline(Readable.fromWeb(upstream.body), res);
    else res.end();
  } catch (e) {
    if (!res.headersSent)
      res
        .status(502)
        .json({ error: { message: e.name === 'AbortError' ? '请求已取消或超时' : e.message } });
    else res.end();
  } finally {
    clearTimeout(timer);
    await dispatcher?.close().catch(() => {});
    await Promise.all((req.files || []).map((f) => rm(f.path, { force: true })));
  }
});
app.use((err, req, res, next) => {
  Promise.all((req.files || []).map((f) => rm(f.path, { force: true }))).catch(() => {});
  res.status(400).json({ error: { message: err.message } });
});
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('/{*path}', (req, res) => res.sendFile(path.resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, allowedHosts: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
const server = app.listen(process.env.PORT || 3000, '0.0.0.0', (error) => {
  if (error) {
    console.error('Server could not start:', error.code || 'unknown error');
    process.exitCode = 1;
    publication.close();
    return;
  }
  console.log('Atelier is listening on 0.0.0.0:' + (process.env.PORT || 3000));
});
