import { setLanguage } from '../src/i18n.js';
setLanguage('zh-CN', { persist: false });
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, buildPayload, readSSE, imageSource } from '../src/api.js';
const gen = (p = {}, mode = 'generations') =>
  buildPayload({ ...defaults, ...p }, mode, 'a ceramic vase');
test('GPT generation: optional fields and no DALL·E response_format', () => {
  const p = gen();
  assert.equal(p.model, 'gpt-image-2.5-sunburst');
  assert.equal(p.response_format, undefined);
  assert.equal(p.style, undefined);
  assert.equal(p.output_compression, undefined);
  assert.equal(p.partial_images, undefined);
  assert.equal(p.moderation, 'auto');
});
test('GPT edit sends fidelity, not moderation', () => {
  const p = gen({ input_fidelity: 'high' }, 'edits');
  assert.equal(p.input_fidelity, 'high');
  assert.equal(p.moderation, undefined);
});
test('Compression and stream fields', () => {
  const p = gen({ output_format: 'webp', output_compression: 70, stream: true, partial_images: 3 });
  assert.equal(p.output_compression, 70);
  assert.equal(p.partial_images, 3);
  assert.equal(p.stream, true);
});
test('DALL·E 3 only accepts one image', () => {
  assert.throws(() => gen({ model: 'dall-e-3', n: 2 }), /DALL/);
  const p = gen({ model: 'dall-e-3', quality: 'hd' });
  assert.equal(p.style, 'natural');
  assert.equal(p.response_format, 'b64_json');
  assert.equal(p.background, undefined);
});
test('DALL·E 3 cannot edit', () => assert.throws(() => gen({ model: 'dall-e-3' }, 'edits')));
test('Variations only DALL·E 2, no prompt/quality', () => {
  assert.throws(() => gen({}, 'variations'));
  const p = gen({ model: 'dall-e-2' }, 'variations');
  assert.equal(p.prompt, undefined);
  assert.equal(p.quality, undefined);
  assert.equal(p.model, 'dall-e-2');
});
test('Transparent JPEG blocked', () =>
  assert.throws(() => gen({ background: 'transparent', output_format: 'jpeg' })));
test('Custom GPT 2 resolution and constraints', () => {
  assert.equal(gen({ size: '1536x864' }).size, '1536x864');
  for (const size of ['1x1', '4000x4000', '1024x128', '1537x864'])
    assert.throws(() => gen({ size }));
  assert.throws(() => gen({ model: 'gpt-image-1', size: '1536x864' }));
});
test('Extension JSON passes through without allowing credential/prompt overrides', () => {
  assert.equal(gen({ extra: '{"seed":42}' }).seed, 42);
  assert.throws(() => gen({ extra: '{"api_key":"x"}' }));
  assert.throws(() => gen({ extra: '{"model":"x"}' }));
  assert.throws(() => gen({ extra: '[]' }));
  assert.throws(() => gen({ extra: 'x' }));
});
test('Prompt length validation', () =>
  assert.throws(() =>
    buildPayload({ ...defaults, model: 'dall-e-2' }, 'generations', 'x'.repeat(1001)),
  ));
test('SSE handles chunk boundaries, CRLF, multiline data, event fallback and DONE', async () => {
  const s =
    ': comment\r\nevent: image_generation.partial_image\r\ndata: {"b64_json": "abc",\r\ndata: "partial_image_index":0}\r\n\r\nevent: image_generation.completed\r\ndata: {"b64_json":"xyz"}\r\n\r\ndata: [DONE]\r\n\r\n';
  const chunks = [...new TextEncoder().encode(s)].map((x) => new Uint8Array([x]));
  const events = [];
  await readSSE(
    new ReadableStream({
      start(c) {
        chunks.forEach((x) => c.enqueue(x));
        c.close();
      },
    }),
    (e) => events.push(e),
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'image_generation.partial_image');
  assert.equal(events[1].b64_json, 'xyz');
});
test('SSE flushes final event without blank line', async () => {
  const events = [];
  await readSSE(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"type":"image_edit.completed","b64_json":"a"}'));
        c.close();
      },
    }),
    (e) => events.push(e),
  );
  assert.equal(events.length, 1);
});
test('Image data supports b64 and http URL, blocks unsafe protocols', () => {
  assert.equal(imageSource({ b64_json: 'abc' }, 'webp'), 'data:image/webp;base64,abc');
  assert.equal(
    imageSource({ url: 'https://example.com/image.png' }),
    'https://example.com/image.png',
  );
  assert.throws(() => imageSource({ url: 'javascript:alert(1)' }));
});
