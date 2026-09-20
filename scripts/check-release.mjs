import dotenv from 'dotenv';
import { publicationConfig } from '../server/pollinations.js';
dotenv.config({ quiet: true });
let failed = false;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failed = true;
}
try {
  const c = publicationConfig();
  check('Permanent public app origin is configured', !!c.origin);
  check('Registered public App Key is configured (value not printed)', !!c.clientId);
  check('Custom-provider forwarding is disabled for the public edition', !c.allowCustomProviders);
  if (c.redirectUri) console.log('Register this exact callback: ' + c.redirectUri);
  if (!c.contactUrl) console.log('NOTE  Operator contact link is not configured (recommended).');
  if (!c.sourceUrl)
    console.log('NOTE  Public source URL is not configured (optional in the submission template).');
  if (process.argv.includes('--live') && c.origin) {
    for (const route of ['/healthz', '/api/app', '/privacy', '/terms']) {
      try {
        const response = await fetch(c.origin + route, {
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        check('Public route ' + route, response.ok);
        if (route === '/api/app' && response.ok) {
          const body = await response.json();
          check('Live deployment reports OAuth configured', body.authReady === true);
          check('Live callback matches the configured origin', body.redirectUri === c.redirectUri);
        }
      } catch {
        check('Public route ' + route, false);
      }
    }
  }
  console.log(
    '\nThis check does not test OAuth consent or spend Pollen. Complete the manual live checklist before submitting.',
  );
} catch (e) {
  console.error('FAIL  ' + e.message);
  failed = true;
}
process.exitCode = failed ? 1 : 0;
