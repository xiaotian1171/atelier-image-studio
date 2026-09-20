import { tr } from './i18n.js';
export const MODELS = [
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst-2026-09-08',
  'gpt-image-2.5-flare-2026-09-08',
  'gpt-image-2',
  'gpt-image-2-2026-04-21',
  'gpt-image-1.5',
  'gpt-image-1',
  'gpt-image-1-mini',
  'chatgpt-image-latest',
  'dall-e-3',
  'dall-e-2',
];
export const defaults = {
  model: MODELS[0],
  size: '1024x1024',
  quality: 'auto',
  n: 1,
  background: 'auto',
  output_format: 'png',
  output_compression: 100,
  moderation: 'auto',
  stream: false,
  partial_images: 2,
  input_fidelity: '',
  style: 'natural',
  response_format: 'b64_json',
  user: '',
  extra: '{}',
  resolution: '',
};
export const family = (m) => (m === 'dall-e-2' ? 'd2' : m === 'dall-e-3' ? 'd3' : 'gpt');
export function buildPayload(p, mode, prompt, base = '') {
  if (isPollinations(base)) return buildPollinationsPayload(p, mode, prompt);
  const f = family(p.model);
  let v = { model: p.model, n: Number(p.n), size: p.size };
  if (mode !== 'variations') v.prompt = prompt;
  if (mode !== 'variations') v.quality = p.quality;
  if (f === 'gpt') {
    Object.assign(v, {
      background: p.background,
      output_format: p.output_format,
      stream: p.stream,
    });
    if (p.output_format !== 'png') v.output_compression = Number(p.output_compression);
    if (mode === 'generations') v.moderation = p.moderation;
    if (mode === 'edits' && p.input_fidelity) v.input_fidelity = p.input_fidelity;
    if (p.stream) v.partial_images = Number(p.partial_images);
  } else {
    v.response_format = p.response_format;
    if (f === 'd3') v.style = p.style;
  }
  if (p.user.trim()) v.user = p.user.trim();
  const extra = parseExtra(p.extra);
  v = { ...v, ...extra };
  validate(v, mode);
  return v;
}
export function validate(v, mode) {
  const f = family(v.model);
  if (!v.model.trim()) throw new Error(tr('请输入模型名称'));
  if (
    mode !== 'variations' &&
    (!v.prompt?.trim() || v.prompt.length > (f === 'd2' ? 1000 : f === 'd3' ? 4000 : 32000))
  )
    throw new Error(tr('请填写提示词，并确保长度在模型限制内'));
  if (!Number.isInteger(v.n) || v.n < 1 || v.n > 10 || (f === 'd3' && v.n !== 1))
    throw new Error(tr('数量须为 1–10，DALL·E 3 仅支持 1 张'));
  if (mode === 'variations' && f !== 'd2') throw new Error(tr('变体接口仅支持 DALL·E 2'));
  if (mode === 'edits' && f === 'd3') throw new Error(tr('DALL·E 3 不支持编辑'));
  if (v.background === 'transparent' && v.output_format === 'jpeg')
    throw new Error(tr('透明背景请选择 PNG 或 WebP'));
  if (
    v.output_compression !== undefined &&
    (!Number.isInteger(v.output_compression) ||
      v.output_compression < 0 ||
      v.output_compression > 100)
  )
    throw new Error(tr('压缩质量须为 0–100'));
  if (
    v.partial_images !== undefined &&
    (!Number.isInteger(v.partial_images) || v.partial_images < 0 || v.partial_images > 3)
  )
    throw new Error(tr('流式预览数量须为 0–3'));
  const standard =
    f === 'd2'
      ? ['256x256', '512x512', '1024x1024']
      : f === 'd3'
        ? ['1024x1024', '1792x1024', '1024x1792']
        : ['auto', '1024x1024', '1536x1024', '1024x1536'];
  if (!standard.includes(v.size)) {
    if (f !== 'gpt' || /^gpt-image-1/.test(v.model)) throw new Error(tr('当前模型不支持此尺寸'));
    const match = /^(\d+)x(\d+)$/.exec(v.size);
    const w = Number(match?.[1]),
      h = Number(match?.[2]);
    if (
      !w ||
      !h ||
      w % 16 ||
      h % 16 ||
      w / h < 1 / 3 ||
      w / h > 3 ||
      w * h > 3840 * 2160 ||
      Math.max(w, h) > 3840
    )
      throw new Error(
        tr(
          '自定义尺寸必须为 WIDTHxHEIGHT，边长是 16 的倍数，比例 1:3–3:1，最多 8294400 像素；具体限制以模型为准',
        ),
      );
  }
}
export async function readSSE(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  function emit(block) {
    const lines = block.split('\n');
    let type = '';
    const data = [];
    for (const line of lines) {
      if (line.startsWith('event:')) type = line.slice(6).trim();
      if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return;
    const s = data.join('\n');
    if (s === '[DONE]') return;
    const e = JSON.parse(s);
    if (!e.type && type) e.type = type;
    onEvent(e);
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let pos;
      while ((pos = buffer.indexOf('\n\n')) >= 0) {
        emit(buffer.slice(0, pos));
        buffer = buffer.slice(pos + 2);
      }
      if (done) break;
    }
    if (buffer.trim()) emit(buffer);
  } finally {
    reader.releaseLock();
  }
}
export function imageSource(d, format = 'png') {
  if (d.b64_json) return 'data:image/' + format + ';base64,' + d.b64_json;
  if (d.url && /^https?:\/\//.test(d.url)) return d.url;
  throw new Error(tr('响应没有有效的图片数据'));
}
export function imageInfo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file),
      im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: im.width, h: im.height, image: im });
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(tr('无法读取图片：') + file.name));
    };
    im.src = url;
  });
}
export async function validateFiles(files, mask, model, mode) {
  if (mode === 'generations') return;
  const d2 = family(model) === 'd2';
  if (!files.length || files.length > (d2 ? 1 : 16))
    throw new Error(d2 ? tr('请上传一张原图') : tr('请上传 1–16 张参考图'));
  for (const file of files) {
    if (
      !(d2 ? ['image/png'] : ['image/png', 'image/jpeg', 'image/webp']).includes(file.type) ||
      file.size >= (d2 ? 4 : 50) * 1024 * 1024
    )
      throw new Error(
        d2
          ? tr('DALL·E 2 需要小于 4MB 的正方形 PNG')
          : tr('参考图需要小于 50MB 的 PNG、JPEG 或 WebP'),
      );
    const { w, h } = await imageInfo(file);
    if (d2 && w !== h) throw new Error(tr('DALL·E 2 原图必须是正方形'));
  }
  if (mask && mode === 'edits') {
    if (mask.type !== 'image/png' || mask.size >= 4 * 1024 * 1024)
      throw new Error(tr('蒙版需要小于 4MB 的 PNG'));
    const [a, b] = await Promise.all([imageInfo(files[0]), imageInfo(mask)]);
    if (a.w !== b.w || a.h !== b.h) throw new Error(tr('蒙版尺寸须与第一张原图一致'));
    const c = document.createElement('canvas');
    c.width = b.w;
    c.height = b.h;
    const ctx = c.getContext('2d');
    ctx.drawImage(b.image, 0, 0);
    const pixels = ctx.getImageData(0, 0, b.w, b.h).data;
    let alpha = false;
    for (let i = 3; i < pixels.length; i += 4)
      if (pixels[i] === 0) {
        alpha = true;
        break;
      }
    if (!alpha) throw new Error(tr('蒙版中没有完全透明的区域；透明区域代表需要重绘的位置'));
  }
}
const db = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open('atelier-library', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('works', { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export async function library(action, value) {
  const d = await db();
  try {
    return await new Promise((resolve, reject) => {
      const tx = d.transaction('works', action === 'list' ? 'readonly' : 'readwrite');
      const s = tx.objectStore('works');
      const r =
        action === 'list'
          ? s.getAll()
          : action === 'put'
            ? s.put(value)
            : action === 'clear'
              ? s.clear()
              : s.delete(value);
      tx.oncomplete = () => resolve(r.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    d.close();
  }
}

function parseExtra(text) {
  let extra;
  try {
    extra = JSON.parse(text || '{}');
  } catch {
    throw new Error(tr('扩展参数必须是有效的 JSON'));
  }
  if (!extra || Array.isArray(extra) || typeof extra !== 'object')
    throw new Error(tr('扩展参数必须是 JSON 对象'));
  for (const k of Object.keys(extra))
    if (
      [
        'model',
        'prompt',
        'image',
        'image[]',
        'mask',
        'api_key',
        'authorization',
        '__proto__',
        'constructor',
        'prototype',
      ].includes(k)
    )
      throw new Error(tr('扩展参数不能覆盖 ') + k);

  return extra;
}

export const POLLINATIONS_MODELS = [
  'openai/gpt-image-2',
  'openai/gpt-image-1.5',
  'openai/gpt-image-1-mini',
  'openai/gpt-image-2.5-sunburst',
  'openai/gpt-image-2.5-flare',
  'black-forest-labs/flux.1-schnell',
  'black-forest-labs/flux.1-kontext-pro',
  'black-forest-labs/flux.2-klein-4b',
  'google/gemini-3.1-flash-image',
];
export function isPollinations(base) {
  try {
    return new URL(base).hostname === 'gen.pollinations.ai';
  } catch {
    return false;
  }
}
export function pollinationsDefaults(p = defaults) {
  return {
    ...p,
    model: MODELS.includes(p.model)
      ? 'gpt-image-1.5' === p.model
        ? 'openai/gpt-image-1.5'
        : 'openai/gpt-image-2'
      : p.model,
    n: 1,
    quality: ['standard', 'hd', 'low', 'medium', 'high'].includes(p.quality) ? p.quality : 'medium',
    size: p.size === 'auto' ? '1024x1024' : p.size,
    stream: false,
  };
}
function buildPollinationsPayload(p, mode, prompt) {
  if (mode === 'variations')
    throw new Error(tr('Pollinations 文档未提供图像变体接口，请使用文字生图或图像编辑'));
  const v = {
    model: p.model,
    prompt,
    n: Number(p.n),
    size: p.size,
    quality: p.quality,
    response_format: p.response_format,
  };
  if (p.user.trim() && mode === 'generations') v.user = p.user.trim();
  if (p.resolution) v.resolution = p.resolution;
  const extra = parseExtra(p.extra);
  const allowed = [
    'n',
    'size',
    'quality',
    'response_format',
    'resolution',
    'safe',
    ...(mode === 'generations'
      ? ['user', 'reference_images', 'reference_videos', 'reference_audios']
      : []),
  ];
  for (const key of Object.keys(extra))
    if (!allowed.includes(key))
      throw new Error(
        tr('Pollinations 当前 Images API 文档未列出参数 ') + key + tr('，请从扩展 JSON 移除'),
      );
  Object.assign(v, extra);
  if (!v.model?.trim()) throw new Error(tr('请输入 Pollinations 支持的模型 ID'));
  if (!prompt?.trim() || prompt.length > 32000) throw new Error(tr('请填写 1–32000 字符的提示词'));
  if (v.n !== 1) throw new Error(tr('Pollinations 当前每次只支持 1 张图片（n=1）'));
  if (!['standard', 'hd', 'low', 'medium', 'high'].includes(v.quality))
    throw new Error(tr('Pollinations 不接受 auto / xhigh / max 质量，请选择 medium 或 high'));
  if (!['url', 'b64_json'].includes(v.response_format))
    throw new Error(tr('响应格式须为 url 或 b64_json'));
  if (!/^[1-9]\d*x[1-9]\d*$/.test(v.size))
    throw new Error(tr('Pollinations 尺寸需为 WIDTHxHEIGHT，不接受 auto；尺寸上限由所选模型决定'));
  return v;
}
export function formatApiError(data, status, requestId) {
  const err = data?.error || data || {};
  const message = typeof err === 'string' ? tr(err) : tr(err.message) || tr('请求失败');
  const details = typeof err === 'object' ? err.details : null;
  const parts = [];
  if (details?.fieldErrors)
    for (const [key, items] of Object.entries(details.fieldErrors))
      parts.push(key + ': ' + (Array.isArray(items) ? items.join('; ') : String(items)));
  if (details?.formErrors?.length) parts.push(details.formErrors.join('; '));
  if (details && !parts.length) parts.push(JSON.stringify(details));
  const id = requestId || err.requestId || data?.requestId;
  return (
    'HTTP ' +
    status +
    ' · ' +
    message +
    (parts.length ? '\n' + parts.join('\n') : '') +
    (id ? '\nRequest ID: ' + id : '')
  );
}
