import test from 'node:test';
import assert from 'node:assert/strict';
import { tr, translate, setLanguage, getLanguage, subscribeLanguage } from '../src/i18n.js';
import messages from '../src/locales.json' with { type: 'json' };
import { buildPayload, defaults, formatApiError } from '../src/api.js';
import { parse } from '@babel/parser';
import fs from 'node:fs';
test('English is the default without a saved preference', () => assert.equal(getLanguage(), 'en'));
test('UI copy and parameters interpolate in both languages', () => {
  assert.equal(translate('开始创作', 'en'), 'Start creating');
  assert.equal(translate('开始创作', 'zh-CN'), '开始创作');
  assert.equal(translate('已生成 {0} 张作品', 'en', 3), 'Images created: 3');
  assert.equal(translate('Images created: 3', 'zh-CN'), '已生成 3 张作品');
  assert.equal(translate('正在细化画面 · 预览 2', 'en'), 'Refining the image · Preview 2');
  assert.equal(translate('Unknown upstream message', 'zh-CN'), 'Unknown upstream message');
});
test('Language changes notify subscribers, invalid values are ignored', () => {
  let n = 0;
  const stop = subscribeLanguage(() => n++);
  setLanguage('zh-CN', { persist: false });
  assert.equal(tr('开始创作'), '开始创作');
  assert.equal(n, 1);
  setLanguage('fr', { persist: false });
  assert.equal(getLanguage(), 'zh-CN');
  stop();
  setLanguage('en', { persist: false });
  assert.equal(n, 1);
});
test('API user prompt remains untouched in either UI language', () => {
  const prompt = '用户原文 mixed English & 中文';
  for (const lang of ['zh-CN', 'en']) {
    setLanguage(lang, { persist: false });
    assert.equal(buildPayload(defaults, 'generations', prompt).prompt, prompt);
  }
  assert.match(
    formatApiError({ error: { message: '请先配置有效的 API Key' } }, 502),
    /Configure a valid API key first/,
  );
});
test('Every UI translation key exists and has an English translation', () => {
  const missing = [];
  function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (
      n.type === 'CallExpression' &&
      n.callee.name === 'tr' &&
      n.arguments[0]?.type === 'StringLiteral'
    ) {
      const k = n.arguments[0].value;
      if (!Object.hasOwn(messages, k) || !messages[k]) missing.push(k);
    }
    for (const [k, v] of Object.entries(n)) {
      if (['loc', 'comments', 'tokens'].includes(k)) continue;
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  }
  for (const file of [
    'src/main.jsx',
    'src/api.js',
    'src/i18n.js',
    'src/Publication.jsx',
    'src/usePollinations.js',
  ])
    walk(parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] }));
  assert.deepEqual(missing, []);
});
