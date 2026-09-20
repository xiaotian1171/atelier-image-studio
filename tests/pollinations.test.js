import { setLanguage } from '../src/i18n.js';
setLanguage('zh-CN', { persist: false });
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaults,
  buildPayload,
  isPollinations,
  pollinationsDefaults,
  formatApiError,
} from '../src/api.js';
const base = 'https://gen.pollinations.ai/v1';
const make = (overrides = {}, mode = 'generations') =>
  buildPayload({ ...pollinationsDefaults(), ...overrides }, mode, 'a ceramic vase', base);
test('Pollinations provider exact hostname detection', () => {
  assert.ok(isPollinations(base));
  assert.ok(!isPollinations('https://gen.pollinations.ai.evil.test/v1'));
  assert.ok(!isPollinations('https://api.openai.com/v1'));
});
test('Pollinations defaults fix auto quality and n', () => {
  const p = pollinationsDefaults({ ...defaults, n: 5, stream: true, size: 'auto' });
  assert.equal(p.quality, 'medium');
  assert.equal(p.n, 1);
  assert.equal(p.stream, false);
  assert.equal(p.size, '1024x1024');
  assert.equal(p.model, 'openai/gpt-image-2');
});
test('Pollinations only sends supported core fields', () => {
  assert.deepEqual(
    Object.keys(make()).sort(),
    ['model', 'prompt', 'n', 'size', 'quality', 'response_format'].sort(),
  );
  assert.equal(make().response_format, 'b64_json');
});
test('Pollinations rejects auto quality, multi-image count and variations', () => {
  assert.throws(() => make({ quality: 'auto' }), /不接受 auto/);
  assert.throws(() => make({ n: 2 }), /只支持 1/);
  assert.throws(() => make({}, 'variations'), /变体/);
  assert.throws(() => make({ size: 'auto' }), /WIDTHxHEIGHT/);
});
test('Pollinations supported extensions and unsupported field guard', () => {
  assert.equal(make({ extra: '{"resolution":"1k","safe":true}' }).resolution, '1k');
  assert.throws(() => make({ extra: '{"stream":true}' }), /stream/);
  assert.throws(() => make({ extra: '{"n":3}' }), /只支持 1/);
});
test('Pollinations fieldErrors/formErrors and requestId are visible', () => {
  const result = formatApiError(
    {
      error: {
        message: 'JSON body validation failed',
        details: {
          fieldErrors: { quality: ['Invalid enum value'], n: ['Must equal 1'] },
          formErrors: ['Invalid body'],
        },
        requestId: 'test-id',
      },
    },
    400,
  );
  assert.match(result, /quality: Invalid enum value/);
  assert.match(result, /n: Must equal 1/);
  assert.match(result, /Invalid body/);
  assert.match(result, /test-id/);
});
