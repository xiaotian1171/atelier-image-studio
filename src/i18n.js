import messages from './locales.json' with { type: 'json' };

// Only the language preference is persisted. API credentials never go into storage.
export const LANGUAGE_KEY = 'atelier.language';
const supported = new Set(['en', 'zh-CN']);
function readPreference() {
  try {
    const saved = globalThis.localStorage?.getItem(LANGUAGE_KEY);
    return supported.has(saved) ? saved : 'en';
  } catch {
    return 'en';
  }
}
let language = readPreference();
const listeners = new Set();
const englishKeys = new Map(Object.entries(messages).map(([key, value]) => [value, key]));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = [];
for (const [key, english] of Object.entries(messages)) {
  if (!/\{\d+\}/.test(key)) continue;
  for (const text of [key, english]) {
    const parts = text.split(/(\{\d+\})/);
    templates.push({
      key,
      indexes: parts.filter((v) => /^\{\d+\}$/.test(v)).map((v) => +v.slice(1, -1)),
      pattern: new RegExp(
        '^' +
          parts.map((v) => (/^\{\d+\}$/.test(v) ? '([\\s\\S]*?)' : escapeRegex(v))).join('') +
          '$',
      ),
    });
  }
}
export function getLanguage() {
  return language;
}
export function subscribeLanguage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function translate(text, locale = language, ...values) {
  if (typeof text !== 'string') return text;
  let key = Object.hasOwn(messages, text) ? text : englishKeys.get(text);
  if (!key && !values.length) {
    for (const template of templates) {
      const match = template.pattern.exec(text);
      if (match) {
        key = template.key;
        template.indexes.forEach((index, i) => {
          values[index] = match[i + 1];
        });
        break;
      }
    }
  }
  const result = key ? (locale === 'zh-CN' ? key : messages[key]) : text;
  return result.replace(/\{(\d+)\}/g, (match, index) =>
    values[index] === undefined ? match : String(values[index]),
  );
}
export function tr(text, ...values) {
  return translate(text, language, ...values);
}
function updateDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.title = tr('未形 Atelier — 让想象，有形可见');
}
export function setLanguage(next, { persist = true } = {}) {
  if (!supported.has(next)) return;
  language = next;
  if (persist) {
    try {
      globalThis.localStorage?.setItem(LANGUAGE_KEY, next);
    } catch {
      /* Private browsing may block storage. */
    }
  }
  updateDocument();
  listeners.forEach((listener) => listener());
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LANGUAGE_KEY || event.key === null)
      setLanguage(readPreference(), { persist: false });
  });
}
updateDocument();
