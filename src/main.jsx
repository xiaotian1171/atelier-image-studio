import {
  usePollinations,
  POLLINATIONS_BASE,
  DEFAULT_POLLINATIONS_MODEL,
} from './usePollinations.js';
import { WalletPanel, PolicyContent } from './Publication.jsx';
import { tr, getLanguage, setLanguage, subscribeLanguage } from './i18n.js';
import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  SlidersHorizontal,
  PanelLeftClose,
  Image as ImageIcon,
  Images,
  Settings2,
  BookOpen,
  ChevronDown,
  Check,
  X,
  Upload,
  Download,
  Trash2,
  Copy,
  Heart,
  Search,
  Grid2X2,
  LayoutList,
  RotateCcw,
  LoaderCircle,
  ShieldCheck,
  Link,
  ExternalLink,
  Brush,
  Maximize2,
  CornerDownLeft,
  Clock3,
  FolderOpen,
  Command,
  Info,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  MoreHorizontal,
  Send,
} from 'lucide-react';
import {
  MODELS,
  defaults,
  family,
  buildPayload,
  isPollinations,
  POLLINATIONS_MODELS,
  pollinationsDefaults,
  formatApiError,
  readSSE,
  imageSource,
  validateFiles,
  imageInfo,
  library,
} from './api';
import './style.css';
function IconButton({ title, onClick, children, ...rest }) {
  return (
    <button className="icon-btn" title={title} aria-label={title} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}
function Select({ value, onChange, options, ...rest }) {
  return (
    <div className="select-wrap">
      <select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
        {options.map((o) => (
          <option key={typeof o === 'string' ? o : o[0]} value={typeof o === 'string' ? o : o[0]}>
            {typeof o === 'string' ? o : o[1]}
          </option>
        ))}
      </select>
      <ChevronDown size={13} />
    </div>
  );
}
function Modal({ title, subtitle, onClose, children, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const old = document.activeElement;
    ref.current?.focus();
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const els = ref.current.querySelectorAll(
          'button,input,select,textarea,a[href],[tabindex="0"]',
        );
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      old?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        ref={ref}
        tabIndex={-1}
        className={'modal ' + (wide ? 'wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton title={tr('关闭')} onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  );
}
function MaskEditor({ file, onSave, onClose }) {
  const canvas = useRef(),
    base = useRef(),
    drawing = useRef(false);
  const [brush, setBrush] = useState(50),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const url = URL.createObjectURL(file),
      im = new window.Image();
    im.onload = () => {
      const c = canvas.current;
      c.width = im.width;
      c.height = im.height;
      const b = base.current;
      b.width = im.width;
      b.height = im.height;
      b.getContext('2d').drawImage(im, 0, 0);
      clear();
      setReady(true);
    };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function clear() {
    const c = canvas.current,
      ctx = c.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(24,67,53,1)';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  function draw(e) {
    if (!drawing.current) return;
    const c = canvas.current,
      r = c.getBoundingClientRect(),
      ctx = c.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(
      ((e.clientX - r.left) * c.width) / r.width,
      ((e.clientY - r.top) * c.height) / r.height,
      (brush * c.width) / r.width / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  return (
    <Modal
      title={tr('绘制编辑区域')}
      subtitle={tr('涂抹想要重绘的部分。导出的蒙版中，这些区域为完全透明。')}
      onClose={onClose}
      wide
    >
      <div className="mask-toolbar">
        <Brush size={16} />
        <span>{tr('画笔大小')}</span>
        <input
          aria-label={tr('画笔大小')}
          type="range"
          min="5"
          max="140"
          value={brush}
          onChange={(e) => setBrush(+e.target.value)}
        />
        <span>{brush}px</span>
        <button className="subtle" onClick={clear}>
          <RotateCcw size={14} />
          {tr('重置')}
        </button>
      </div>
      <div className="mask-stage">
        <canvas ref={base} />
        <canvas
          ref={canvas}
          className="mask-overlay"
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            draw(e);
          }}
          onPointerMove={draw}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
        />
      </div>
      <footer className="modal-footer">
        <span className="muted">{tr('浅色区域 = 重绘 · 绿色区域 = 保留')}</span>
        <button
          disabled={!ready}
          className="primary"
          onClick={() =>
            canvas.current.toBlob((blob) => {
              onSave(new File([blob], 'mask.png', { type: 'image/png' }));
              onClose();
            }, 'image/png')
          }
        >
          {tr('使用蒙版')}
          <Check size={16} />
        </button>
      </footer>
    </Modal>
  );
}
function App() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en');
  const inspirations = [
    {
      id: 'ceramic',
      title: tr('光的形状'),
      tag: tr('静物摄影'),
      en: 'THE SHAPE OF LIGHT',
      prompt: tr(
        '一只手工制作的米白色陶瓷花瓶与浅口碗，置于洞石台面上。一枝干燥的橄榄枝，午后阳光斜照，暖灰色肌理墙面。极简静物摄影，柔和胶片颗粒，安静而自然。',
      ),
      color: '#ded4c4',
    },
    {
      id: 'desert',
      title: tr('远方，无声'),
      tag: tr('自然风景'),
      en: 'A QUIET WILDERNESS',
      prompt: tr(
        '美国西部荒漠的辽阔景观，砂岩山脉和赭红色大地，遥远的地平线，清透的天空。旅行杂志风格，35mm 胶片，细腻的自然光。',
      ),
    },
    {
      id: 'architecture',
      title: tr('日常的留白'),
      tag: tr('空间设计'),
      en: 'ROOM TO BREATHE',
      prompt: tr(
        '一间充满自然光的现代客厅，奶油白沙发，木质家具和绿色植物，墙上的艺术画。北欧设计杂志摄影，柔和中性色调。',
      ),
    },
    {
      id: 'coast',
      title: tr('缓慢的海岸'),
      tag: tr('自然风景'),
      en: 'SLOW AFTERNOONS',
      prompt: tr(
        '日落时分的宁静海岸，金色波浪轻轻涌上细沙，温暖的天空倒映在水面上。诗意的风景摄影，电影感，低对比度。',
      ),
    },
  ];
  const account = usePollinations();
  const [walletOpen, setWalletOpen] = useState(false);
  const [legal, setLegal] = useState(
    ['/privacy', '/terms'].includes(window.location.pathname)
      ? window.location.pathname.slice(1)
      : null,
  );
  const openLegal = (kind) => {
    setWalletOpen(false);
    setLegal(kind);
    history.pushState({}, '', '/' + kind);
  };
  const closeLegal = () => {
    setLegal(null);
    history.replaceState({}, '', '/');
  };
  useEffect(() => {
    const update = () =>
      setLegal(
        ['/privacy', '/terms'].includes(window.location.pathname)
          ? window.location.pathname.slice(1)
          : null,
      );
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const LABELS = { generations: tr('文字生图'), edits: tr('图像编辑'), variations: tr('图像变体') };

  const [page, setPage] = useState('studio'),
    [mode, setMode] = useState('generations'),
    [p, setP] = useState(pollinationsDefaults({ ...defaults, model: DEFAULT_POLLINATIONS_MODEL })),
    [prompt, setPrompt] = useState(''),
    [files, setFiles] = useState([]),
    [mask, setMask] = useState(null),
    [drawMask, setDrawMask] = useState(false),
    [advanced, setAdvanced] = useState(false),
    [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false),
    [preview, setPreview] = useState(null),
    [requestView, setRequestView] = useState(false),
    [navOpen, setNavOpen] = useState(false);
  const [config, setConfig] = useState({
      base: POLLINATIONS_BASE,
      key: '',
      organization: '',
      project: '',
    }),
    [draft, setDraft] = useState(config),
    [connection, setConnection] = useState(''),
    [testing, setTesting] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [partial, setPartial] = useState(null),
    [results, setResults] = useState([]),
    [works, setWorks] = useState([]),
    [toast, setToast] = useState(''),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [layout, setLayout] = useState('grid'),
    [elapsed, setElapsed] = useState(0),
    [confirmClear, setConfirmClear] = useState(false);
  const abort = useRef(),
    promptEl = useRef(),
    fileEl = useRef(),
    maskEl = useRef(),
    toastTimer = useRef();
  const poll = isPollinations(config.base);
  const catalogModel = poll
    ? account.models.find((m) => m.id === p.model || m.aliases.includes(p.model))
    : null;
  const modelChoices =
    poll && account.models.length
      ? account.models.filter((m) => mode !== 'edits' || m.canEdit).map((m) => m.id)
      : poll
        ? POLLINATIONS_MODELS
        : MODELS;
  const connected = !!config.key || (poll && account.session.authenticated);
  function openConnection() {
    if (poll) setWalletOpen(true);
    else openSettings();
  }

  const f = family(p.model),
    isGpt = f === 'gpt';
  useEffect(() => {
    library('list')
      .then((v) => setWorks(v.sort((a, b) => b.time - a.time)))
      .catch(() => notify(tr('本地作品库不可用；仍可生成和下载图片')));
  }, []);
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  function notify(s) {
    setToast(s);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }
  const update = (k, v) => setP((s) => ({ ...s, [k]: v }));
  function changeModel(m) {
    const ff = family(m);
    setP((s) => ({
      ...s,
      model: m,
      size: '1024x1024',
      quality: poll ? 'medium' : ff === 'gpt' ? 'auto' : 'standard',
      n: poll || ff === 'd3' ? 1 : s.n,
      stream: !poll && ff === 'gpt' ? s.stream : false,
      resolution: '',
    }));
    if (m === 'dall-e-3') setMode('generations');
  }
  function changeMode(m) {
    setMode(m);
    setError('');
    if (m === 'variations') changeModel('dall-e-2');
    if (m === 'edits' && f === 'd3') changeModel(defaults.model);
    if (poll && m === 'edits' && account.models.length && !catalogModel?.canEdit) {
      const editable =
        account.models.find((x) => x.id === 'black-forest-labs/flux.2-klein-4b' && x.canEdit) ||
        account.models.find((x) => x.canEdit);
      if (editable) {
        changeModel(editable.id);
        notify(tr('已切换到支持参考图的模型，请确认后再生成。'));
      }
    }
  }
  function openSettings() {
    setDraft({ ...config });
    setConnection('');
    setSettings(true);
  }
  function useIdea(idea) {
    setPrompt(idea.prompt);
    setPage('studio');
    setPreview(null);
    setMode('generations');
    notify(tr('提示词已载入，按你的想法继续修改'));
    promptEl.current?.focus();
  }
  async function addFiles(incoming) {
    const list = Array.from(incoming);
    if (files.length + list.length > (f === 'd2' ? 1 : catalogModel?.maxReferences || 16))
      return notify(f === 'd2' ? tr('此模型只能上传 1 张原图') : tr('最多上传 16 张参考图'));
    if (
      list.some(
        (x) =>
          !['image/png', 'image/jpeg', 'image/webp'].includes(x.type) || x.size >= 50 * 1024 * 1024,
      )
    )
      return notify(tr('请上传小于 50MB 的 PNG、JPEG 或 WebP'));
    setFiles((s) => [...s, ...list]);
    if (!files.length) setMask(null);
  }
  function headers(c = config) {
    if (isPollinations(c.base) && account.session.authenticated && !c.key)
      return {
        'x-auth-mode': 'pollinations',
        'x-atelier-request': '1',
        'x-base-url': POLLINATIONS_BASE,
      };
    return {
      'x-api-key': c.key,
      'x-base-url': c.base,
      ...(c.organization ? { 'x-openai-organization': c.organization } : {}),
      ...(c.project ? { 'x-openai-project': c.project } : {}),
    };
  }
  async function testConnection() {
    setTesting(true);
    setConnection('');
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { ...headers(draft), 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || tr('连接失败'));
      setConnection(tr('接口连接成功。生图权限与额度由服务商决定。'));
    } catch (e) {
      setConnection(tr(e.message));
    } finally {
      setTesting(false);
    }
  }
  async function saveWorks(items) {
    setWorks((s) => [...items, ...s]);
    try {
      await Promise.all(items.map((i) => library('put', i)));
    } catch {
      notify(tr('浏览器存储空间不足，请及时下载作品'));
    }
  }
  async function generate() {
    if (busy) return;
    setError('');
    let payload;
    try {
      payload = buildPayload(p, mode, prompt, config.base);
      if (poll && account.session.authenticated) {
        if (!catalogModel) throw new Error(tr('请选择当前官方目录中的图像模型，或刷新模型列表。'));
        if (mode === 'edits' && !catalogModel.canEdit)
          throw new Error(tr('当前模型不支持参考图，请选择支持编辑的模型。'));
        if (
          mode === 'edits' &&
          catalogModel.maxReferences &&
          files.length > catalogModel.maxReferences
        )
          throw new Error(tr('参考图数量超过所选模型的限制。'));
      }
      if (poll && mask && mode === 'edits')
        throw new Error(tr('Pollinations 文档未列出蒙版支持，请移除蒙版后使用参考图编辑'));
      await validateFiles(files, mask, p.model, mode);
    } catch (e) {
      setError(e.message);
      return;
    }
    if (!connected) {
      openConnection();
      return;
    }
    setBusy(true);
    setPartial(null);
    setResults([]);
    setStatus(tr('正在发送请求'));
    abort.current = new AbortController();
    const started = Date.now();
    let count = 0;
    const addResult = (data, meta = {}) => {
      const format =
        meta.output_format ||
        payload.output_format ||
        (data[0]?.b64_json?.startsWith('/9j/')
          ? 'jpeg'
          : data[0]?.b64_json?.startsWith('UklGR')
            ? 'webp'
            : 'png');
      const items = data.map((d) => ({
        id: crypto.randomUUID(),
        src: imageSource(d, format),
        prompt: payload.prompt || tr('图像变体'),
        revised_prompt: d.revised_prompt,
        model: payload.model,
        size: meta.size || payload.size,
        quality: meta.quality || payload.quality,
        format,
        usage: meta.usage,
        requestId: meta.requestId,
        time: Date.now(),
        duration: Math.round((Date.now() - started) / 1000),
        favorite: false,
        mode,
        params: payload,
      }));
      count += items.length;
      setResults((s) => [...s, ...items]);
      saveWorks(items);
    };
    try {
      let body,
        h = headers();
      if (mode === 'generations') {
        body = JSON.stringify(payload);
        h['Content-Type'] = 'application/json';
      } else {
        body = new FormData();
        Object.entries(payload).forEach(([k, v]) =>
          body.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v)),
        );
        files.forEach((file) =>
          body.append(f === 'd2' || (poll && files.length === 1) ? 'image' : 'image[]', file),
        );
        if (mask && mode === 'edits') body.append('mask', mask);
      }
      setStatus(tr('正在创作，这可能需要几分钟'));
      const res = await fetch('/api/' + mode, {
        method: 'POST',
        headers: h,
        body,
        signal: abort.current.signal,
      });
      const requestId = res.headers.get('x-request-id');
      if (!res.ok) {
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: { message: text.slice(0, 400) } };
        }
        throw new Error(formatApiError(data, res.status, requestId));
      }
      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        await readSSE(res.body, (e) => {
          if (e.error || e.type === 'error')
            throw new Error(e.error?.message || e.message || tr('流式请求失败'));
          if (e.type?.endsWith('partial_image')) {
            setPartial(imageSource(e, e.output_format || payload.output_format));
            setStatus(tr('正在细化画面 · 预览 {0}', (e.partial_image_index || 0) + 1));
          } else if (e.type?.endsWith('completed')) {
            addResult(e.data || [e], { ...e, requestId });
            setPartial(null);
          }
        });
      } else {
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        addResult(data.data || [], { ...data, requestId });
      }
      if (!count) throw new Error(tr('服务未返回完整图片，请检查模型及接口兼容性'));
      setStatus(tr('创作完成'));
      notify(tr('已生成 {0} 张作品', count));
    } catch (e) {
      setError(e.name === 'AbortError' ? tr('请求已停止。服务商可能仍会处理并计费。') : e.message);
      setStatus(tr('未完成'));
    } finally {
      if (poll && account.session.authenticated) account.refreshSession();
      setBusy(false);
      setPartial(null);
    }
  }
  useEffect(() => {
    const listener = (e) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === 'Enter' &&
        !settings &&
        !preview &&
        !walletOpen &&
        !legal
      ) {
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });
  async function download(item) {
    try {
      const res = await fetch(item.src);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `atelier-${item.id}.${item.format || 'jpg'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.open(item.src, '_blank', 'noopener,noreferrer');
      notify(tr('远程图片限制了下载，已打开原图；URL 可能在 60 分钟后过期'));
    }
  }
  async function removeWork(item) {
    await library('delete', item.id).catch(() => {});
    setWorks((s) => s.filter((x) => x.id !== item.id));
    setResults((s) => s.filter((x) => x.id !== item.id));
    setPreview(null);
    notify(tr('作品已删除'));
  }
  async function favorite(item) {
    const next = { ...item, favorite: !item.favorite };
    await library('put', next).catch(() => notify(tr('收藏未能保存')));
    setWorks((s) => s.map((x) => (x.id === item.id ? next : x)));
    setResults((s) => s.map((x) => (x.id === item.id ? next : x)));
    if (preview?.id === item.id) setPreview(next);
  }
  async function useAsReference(item) {
    try {
      const res = await fetch(item.src);
      if (!res.ok) throw new Error();
      const b = await res.blob();
      setFiles([new File([b], 'reference.' + (item.format || 'png'), { type: b.type })]);
      setMask(null);
      changeMode('edits');
      setPage('studio');
      setPreview(null);
      notify(tr('已载入为参考图'));
    } catch {
      notify(tr('无法读取远程原图，请先下载后上传'));
    }
  }
  const visibleWorks = works.filter(
    (w) =>
      (filter !== 'favorites' || w.favorite) &&
      (!search ||
        w.prompt.toLowerCase().includes(search.toLowerCase()) ||
        w.model.includes(search)),
  );
  const qualities = poll
    ? ['standard', 'hd', 'low', 'medium', 'high']
    : isGpt
      ? ['auto', 'low', 'medium', 'high', ...(/2\.5/.test(p.model) ? ['xhigh', 'max'] : [])]
      : f === 'd3'
        ? ['standard', 'hd']
        : ['standard'];
  const sizes = poll
    ? ['1024x1024', '1536x1024', '1024x1536', '512x512']
    : f === 'd2'
      ? ['1024x1024', '512x512', '256x256']
      : f === 'd3'
        ? ['1024x1024', '1792x1024', '1024x1792']
        : ['1024x1024', '1536x1024', '1024x1536', 'auto'];
  function workCard(item) {
    return (
      <article className="work-card" key={item.id}>
        <button className="work-image" onClick={() => setPreview(item)}>
          <img src={item.src} alt={item.prompt} loading="lazy" />
          <span className="expand">
            <Maximize2 size={16} />
          </span>
        </button>
        <div className="work-meta">
          <div>
            <h4>{item.prompt}</h4>
            <small>
              {item.size} <span>·</span> {item.format?.toUpperCase()}
            </small>
          </div>
          <IconButton
            title={item.favorite ? tr('取消收藏') : tr('收藏')}
            onClick={() => favorite(item)}
          >
            <Heart size={16} fill={item.favorite ? 'currentColor' : 'none'} />
          </IconButton>
        </div>
      </article>
    );
  }
  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (navOpen ? 'open' : '')}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage('studio');
          }}
        >
          <span className="brand-mark">
            a<span>・</span>
          </span>
          <span>
            {tr('未形')}
            <span className="brand-en">ATELIER</span>
          </span>
        </a>
        <div className="side-label">{tr('你的创意空间')}</div>
        <nav>
          <button
            className={page === 'studio' ? 'active' : ''}
            onClick={() => {
              setPage('studio');
              setNavOpen(false);
            }}
          >
            <SlidersHorizontal size={18} />
            {tr('创作工作台')}
            <span className="nav-dot" />
          </button>
          <button
            className={page === 'library' ? 'active' : ''}
            onClick={() => {
              setPage('library');
              setNavOpen(false);
            }}
          >
            <Images size={18} />
            {tr('我的作品')}
            <span className="nav-count">{works.length}</span>
          </button>
          <button
            className={page === 'inspiration' ? 'active' : ''}
            onClick={() => {
              setPage('inspiration');
              setNavOpen(false);
            }}
          >
            <BookOpen size={18} />
            {tr('灵感手册')}
            <ArrowUpRight size={13} className="nav-tail" />
          </button>
        </nav>
        <div className="sidebar-note">
          <div className="note-shape">✳</div>
          <p>
            {tr('每一个好作品，')}
            <br />
            {tr('都始于一个小想法。')}
          </p>
          <span>MAKE ROOM FOR IDEAS.</span>
        </div>
        <div className="side-bottom">
          <button onClick={() => setHelp(true)}>
            <Info size={17} />
            {tr('使用指南')}
            <ArrowUpRight size={13} />
          </button>
          <button onClick={openConnection}>
            <Settings2 size={17} />
            {poll ? tr('Pollen 账户') : tr('接口设置')}
            <span className={'status-dot ' + (connected ? 'connected' : '')} />
          </button>
          <div className="profile">
            <span>W</span>
            <div>
              {tr('我的工作空间')}
              <small>{tr('本地存储 · 私密创作')}</small>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <IconButton title={tr('切换导航')} onClick={() => setNavOpen(!navOpen)}>
              <PanelLeftClose size={17} />
            </IconButton>
            <span className="divider" />
            {tr('工作空间')}
            <span>/</span>
            <strong>
              {page === 'studio'
                ? tr('创作工作台')
                : page === 'library'
                  ? tr('我的作品')
                  : tr('灵感手册')}
            </strong>
          </div>
          <div className="top-actions">
            <div className="language-picker">
              <Select
                aria-label={tr('语言')}
                value={language}
                onChange={setLanguage}
                options={[
                  ['en', 'English'],
                  ['zh-CN', '简体中文'],
                ]}
              />
            </div>
            <a
              className="protocol-label"
              href="https://pollinations.ai"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="tiny-dot" />
              Powered by Pollinations
            </a>
            <button className="connection-button" onClick={openConnection}>
              <span className={'status-dot ' + (connected ? 'connected' : '')} />
              {poll
                ? account.session.authenticated
                  ? tr('Pollen 已连接')
                  : config.key
                    ? tr('已配置接口')
                    : tr('登录')
                : config.key
                  ? tr('已配置接口')
                  : tr('连接 API')}
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === 'studio'
                  ? 'THE CREATIVE WORKSPACE'
                  : page === 'library'
                    ? 'YOUR PERSONAL COLLECTION'
                    : 'A LITTLE INSPIRATION'}
              </div>
              <h1>
                {page === 'studio' ? (
                  <>
                    {tr('让想象，')}
                    <span>{tr('有形可见。')}</span>
                  </>
                ) : page === 'library' ? (
                  tr('好的想法，值得留下。')
                ) : (
                  tr('灵感，藏在细节里。')
                )}
              </h1>
              <p>
                {page === 'studio'
                  ? tr('从一句描述到一幅作品。在这里，专注于你的下一个想法。')
                  : page === 'library'
                    ? tr('你的每一次探索，都保存在这个浏览器中。')
                    : tr('从一束光、一种材质、一个瞬间，开启新的创作。')}
              </p>
            </div>
            <div className="heading-detail">
              <span className="little-cross">+</span>
              <span>
                {tr('想象不设限')}
                <br />
                <b>CREATE WITHOUT LIMITS</b>
              </span>
            </div>
          </div>
          {page === 'studio' ? (
            <div className="workspace-grid">
              <section className="composer">
                <div className="composer-title">
                  <h2>
                    <span className="section-index">01</span>
                    {tr('构思你的画面')}
                  </h2>
                  <IconButton
                    title={tr('重置创作参数')}
                    onClick={() => {
                      setP(
                        poll
                          ? pollinationsDefaults({ ...defaults, model: DEFAULT_POLLINATIONS_MODEL })
                          : { ...defaults },
                      );
                      setPrompt('');
                      setMode('generations');
                      setFiles([]);
                      setMask(null);
                      setError('');
                    }}
                  >
                    <RotateCcw size={15} />
                  </IconButton>
                </div>
                <div className="mode-tabs">
                  {Object.entries(LABELS).map(([key, label]) => (
                    <button
                      className={mode === key ? 'selected' : ''}
                      onClick={() => changeMode(key)}
                      disabled={poll && key === 'variations'}
                      title={
                        poll && key === 'variations' ? tr('Pollinations 文档未提供此接口') : label
                      }
                      key={key}
                    >
                      {key === 'generations' ? (
                        <ImageIcon size={15} />
                      ) : key === 'edits' ? (
                        <Brush size={15} />
                      ) : (
                        <Images size={15} />
                      )}{' '}
                      {label}
                    </button>
                  ))}
                </div>
                <div className="composer-body">
                  {poll && (
                    <p className="notice" style={{ marginBottom: 16 }}>
                      {tr('Pollinations · 每次 1 张 · 模型名称以服务商目录为准，可直接输入。')}
                    </p>
                  )}
                  <Field label={tr('生成模型')} hint="MODEL">
                    <div className="model-picker">
                      <span className="model-emblem">◎</span>
                      <input
                        list="models"
                        aria-label={tr('生成模型')}
                        value={p.model}
                        onChange={(e) => changeModel(e.target.value)}
                      />
                      <datalist id="models">
                        {modelChoices.map((m) => (
                          <option value={m} key={m} />
                        ))}
                      </datalist>
                      <ChevronDown size={14} />
                    </div>
                  </Field>
                  {poll && (
                    <div className="catalog-status">
                      {catalogModel ? (
                        <>
                          <span>
                            {catalogModel.canEdit ? tr('支持参考图编辑') : tr('仅文字生图')}
                            {catalogModel.maxReferences
                              ? ` · ${catalogModel.maxReferences} ${tr('张参考图')}`
                              : ''}
                            {catalogModel.paidOnly ? ' · ' + tr('需要付费额度') : ''}
                          </span>
                          <a
                            href="https://enter.pollinations.ai/models"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {tr('模型价格')}
                            <ArrowUpRight size={11} />
                          </a>
                        </>
                      ) : (
                        <span>
                          {account.catalogError
                            ? tr('模型目录暂不可用，请重试。')
                            : account.models.length
                              ? tr('自定义模型：请确认服务商支持。')
                              : tr('正在读取官方模型目录…')}
                        </span>
                      )}
                      <button
                        aria-label={tr('刷新模型目录')}
                        title={tr('刷新模型目录')}
                        onClick={account.loadCatalog}
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>
                  )}
                  {mode !== 'generations' && (
                    <div className="reference-block">
                      <div className="label-row">
                        {mode === 'variations' ? tr('原始图片') : tr('参考图片')}
                        <small>
                          {files.length} / {f === 'd2' ? 1 : catalogModel?.maxReferences || 16}
                        </small>
                      </div>
                      <input
                        ref={fileEl}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple={f !== 'd2'}
                        hidden
                        onChange={(e) => {
                          addFiles(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <button
                        className="upload-zone"
                        onClick={() => fileEl.current.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          addFiles(e.dataTransfer.files);
                        }}
                      >
                        <Upload size={20} />
                        <span>{tr('点击上传，或拖入参考图')}</span>
                        <small>{tr('PNG / JPG / WebP · 每张小于 50 MB')}</small>
                      </button>
                      {files.length > 0 && (
                        <div className="file-list">
                          {files.map((file, i) => (
                            <div key={i}>
                              <span>
                                {i + 1}. {file.name}
                              </span>
                              <IconButton
                                title={tr('移除参考图')}
                                onClick={() => {
                                  setFiles(files.filter((_, n) => n !== i));
                                  if (i === 0) setMask(null);
                                }}
                              >
                                <X size={13} />
                              </IconButton>
                            </div>
                          ))}
                        </div>
                      )}
                      {mode === 'edits' && files.length > 0 && !poll && (
                        <>
                          <div className="mask-actions">
                            <button className="subtle" onClick={() => setDrawMask(true)}>
                              <Brush size={14} />
                              {tr('绘制蒙版')}
                            </button>
                            <button className="subtle" onClick={() => maskEl.current.click()}>
                              <Upload size={14} />
                              {tr('上传蒙版')}
                            </button>
                            <input
                              ref={maskEl}
                              type="file"
                              accept="image/png"
                              hidden
                              onChange={(e) => {
                                setMask(e.target.files[0] || null);
                                e.target.value = '';
                              }}
                            />
                          </div>
                          {mask && (
                            <div className="mask-attached">
                              <Check size={13} />
                              {mask.name}
                              <IconButton title={tr('移除蒙版')} onClick={() => setMask(null)}>
                                <X size={13} />
                              </IconButton>
                            </div>
                          )}
                          <small className="muted">
                            {tr('蒙版作用于第一张图；透明区域将被重绘。')}
                          </small>
                        </>
                      )}
                    </div>
                  )}
                  {mode !== 'variations' ? (
                    <div className="prompt-section">
                      <div className="label-row">
                        {tr('画面描述')}{' '}
                        <button
                          className="text-link"
                          onClick={() =>
                            useIdea(inspirations[Math.floor(Math.random() * inspirations.length)])
                          }
                        >
                          {tr('试试灵感')}
                          <ArrowUpRight size={12} />
                        </button>
                      </div>
                      <div className="prompt-box">
                        <textarea
                          ref={promptEl}
                          aria-label={tr('画面描述')}
                          placeholder={tr(
                            '描述你想看到的画面…\n\n试着说说主体、环境、光线与风格，\n细节会让想象更生动。',
                          )}
                          value={prompt}
                          maxLength={f === 'd2' ? 1000 : f === 'd3' ? 4000 : 32000}
                          onChange={(e) => setPrompt(e.target.value)}
                        />
                        <div className="prompt-bottom">
                          <span>{tr('好的画面，从好的描述开始')}</span>
                          <span>
                            {prompt.length.toLocaleString()} /{' '}
                            {f === 'd2' ? '1,000' : f === 'd3' ? '4,000' : '32,000'}
                          </span>
                        </div>
                      </div>
                      <div className="prompt-tags">
                        {[tr('胶片摄影'), tr('极简构图'), tr('自然光')].map((t) => (
                          <button
                            key={t}
                            onClick={() =>
                              setPrompt((s) => s + (s ? (language === 'en' ? ', ' : '，') : '') + t)
                            }
                          >
                            <Plus size={11} />
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="notice">
                      {tr(
                        'DALL·E 2 专属接口：依据原图生成变体，无需提示词。旧模型能否使用取决于服务商。',
                      )}
                    </p>
                  )}
                  <div className="label-row">
                    {tr('画面尺寸')}
                    <small>ASPECT RATIO</small>
                  </div>
                  <div className="size-buttons">
                    {sizes.map((s, i) => (
                      <button
                        key={s}
                        className={p.size === s ? 'selected' : ''}
                        onClick={() => update('size', s)}
                      >
                        {i === 0 ? (
                          <Square size={20} />
                        ) : i === 1 ? (
                          <RectangleHorizontal size={24} />
                        ) : i === 2 ? (
                          <RectangleVertical size={20} />
                        ) : (
                          <Maximize2 size={19} />
                        )}
                        <span>
                          {s === 'auto'
                            ? tr('自动')
                            : s.split('x')[0] === s.split('x')[1]
                              ? i === 0
                                ? '1:1'
                                : s.split('x')[0]
                              : i === 1
                                ? tr('横向')
                                : tr('竖向')}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="size-caption">
                    {p.size === 'auto'
                      ? tr('模型自动选择尺寸')
                      : p.size.replace('x', ' × ') + ' px'}
                    <span>{isGpt ? tr('适合你的每一种构图') : tr('按模型支持的尺寸输出')}</span>
                  </div>
                  <div className="two-cols">
                    <Field label={tr('画面质量')}>
                      <Select
                        value={p.quality}
                        onChange={(v) => update('quality', v)}
                        options={qualities.map((q) => [
                          q,
                          {
                            auto: tr('自动 · Auto'),
                            low: tr('低 · Low'),
                            medium: tr('中 · Medium'),
                            high: tr('高 · High'),
                            xhigh: tr('超高 · XHigh'),
                            max: tr('最高 · Max'),
                            standard: tr('标准 · Standard'),
                            hd: tr('高清 · HD'),
                          }[q],
                        ])}
                      />
                    </Field>
                    <Field label={tr('生成数量')}>
                      <div className="stepper">
                        <button
                          aria-label={tr('减少数量')}
                          disabled={p.n <= 1}
                          onClick={() => update('n', Math.max(1, p.n - 1))}
                        >
                          <Minus size={14} />
                        </button>
                        <span>
                          {p.n}
                          <small>
                            {language === 'en' ? (p.n === 1 ? ' image' : ' images') : ' 张'}
                          </small>
                        </span>
                        <button
                          aria-label={tr('增加数量')}
                          disabled={p.n >= (poll || f === 'd3' ? 1 : 10)}
                          onClick={() =>
                            update('n', Math.min(poll || f === 'd3' ? 1 : 10, p.n + 1))
                          }
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </Field>
                  </div>
                  <button
                    className={'advanced-toggle ' + (advanced ? 'opened' : '')}
                    onClick={() => setAdvanced(!advanced)}
                  >
                    <span>
                      <SlidersHorizontal size={15} />
                      {tr('更多创作设置')}
                    </span>
                    <span className="muted">
                      {poll ? tr('Pollinations 兼容模式') : tr('格式、背景、流式')}
                      <ChevronDown size={14} />
                    </span>
                  </button>
                  {advanced && (
                    <div className="advanced-panel">
                      {poll ? (
                        <>
                          <p className="notice">
                            {tr(
                              'Pollinations 专用适配：每次 1 张；不发送其文档未列出的流式、透明背景、压缩、蒙版和保真度参数。图像编辑需选择支持参考图的模型。',
                            )}
                          </p>
                          <Field label={tr('响应格式')}>
                            <Select
                              value={p.response_format}
                              onChange={(v) => update('response_format', v)}
                              options={['b64_json', 'url']}
                            />
                          </Field>
                          {catalogModel?.resolutions.length > 0 && (
                            <Field label={tr('模型分辨率')} hint={tr('服务商目录')}>
                              <Select
                                value={p.resolution || ''}
                                onChange={(v) => update('resolution', v)}
                                options={[
                                  ['', tr('不发送（模型默认）')],
                                  ...catalogModel.resolutions,
                                ]}
                              />
                              <small>{tr('选择分辨率后，模型可能忽略自定义像素尺寸。')}</small>
                            </Field>
                          )}
                          <Field label={tr('自定义尺寸')}>
                            <input
                              aria-label={tr('自定义尺寸')}
                              value={p.size}
                              onChange={(e) => update('size', e.target.value)}
                              placeholder="1024x1024"
                            />
                            <small>{tr('必须是 WIDTHxHEIGHT，具体支持范围由所选模型决定。')}</small>
                          </Field>
                        </>
                      ) : isGpt ? (
                        <>
                          <div className="two-cols">
                            <Field label={tr('输出格式')}>
                              <Select
                                value={p.output_format}
                                onChange={(v) => update('output_format', v)}
                                options={['png', 'jpeg', 'webp']}
                              />
                            </Field>
                            <Field label={tr('背景')}>
                              <Select
                                value={p.background}
                                onChange={(v) => update('background', v)}
                                options={['auto', 'opaque', 'transparent']}
                              />
                            </Field>
                          </div>
                          {p.output_format !== 'png' && (
                            <Field label={tr('压缩质量')} hint={p.output_compression + '%'}>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={p.output_compression}
                                onChange={(e) => update('output_compression', +e.target.value)}
                              />
                            </Field>
                          )}
                          {mode === 'generations' && (
                            <Field label={tr('内容审核 moderation')}>
                              <Select
                                value={p.moderation}
                                onChange={(v) => update('moderation', v)}
                                options={[
                                  ['auto', tr('自动（默认）')],
                                  ['low', tr('较宽松 · Low')],
                                ]}
                              />
                            </Field>
                          )}
                          {mode === 'edits' && (
                            <Field label={tr('输入保真度 input_fidelity')}>
                              <Select
                                value={p.input_fidelity}
                                onChange={(v) => update('input_fidelity', v)}
                                options={[['', tr('不发送（模型默认）')], 'high', 'low']}
                              />
                              <small>{tr('GPT Image 2 忽略此参数；其他模型依能力支持。')}</small>
                            </Field>
                          )}
                          <div className="switch-row">
                            <span>
                              {tr('流式预览')}
                              <small>{tr('生成过程中逐步显示画面')}</small>
                            </span>
                            <button
                              className={'switch ' + (p.stream ? 'on' : '')}
                              role="switch"
                              aria-checked={p.stream}
                              aria-label={tr('流式预览')}
                              onClick={() => update('stream', !p.stream)}
                            >
                              <span />
                            </button>
                          </div>
                          {p.stream && (
                            <Field label={tr('中间预览数量')} hint={tr('可能增加 token 消耗')}>
                              <Select
                                value={p.partial_images}
                                onChange={(v) => update('partial_images', +v)}
                                options={[0, 1, 2, 3].map((v) => [v, String(v)])}
                              />
                            </Field>
                          )}
                          {!/^gpt-image-1/.test(p.model) && (
                            <Field label={tr('自定义尺寸')} hint={tr('16 的倍数')}>
                              <input
                                value={p.size}
                                aria-label={tr('自定义尺寸')}
                                onChange={(e) => update('size', e.target.value)}
                                placeholder="1536x864"
                              />
                              <small>{tr('大于 2560×1440 为实验性；最终限制由模型校验。')}</small>
                            </Field>
                          )}
                        </>
                      ) : (
                        <>
                          <Field label={tr('响应格式')}>
                            <Select
                              value={p.response_format}
                              onChange={(v) => update('response_format', v)}
                              options={['b64_json', 'url']}
                            />
                            {p.response_format === 'url' && (
                              <small>{tr('远程链接通常仅有效 60 分钟，请及时下载。')}</small>
                            )}
                          </Field>
                          {f === 'd3' && (
                            <Field label={tr('画面风格')}>
                              <Select
                                value={p.style}
                                onChange={(v) => update('style', v)}
                                options={['natural', 'vivid']}
                              />
                            </Field>
                          )}
                        </>
                      )}
                      <Field label={tr('终端用户标识 user')} hint={tr('可选')}>
                        <input
                          value={p.user}
                          onChange={(e) => update('user', e.target.value)}
                          placeholder="user_123"
                        />
                      </Field>
                      <Field label={tr('扩展参数 JSON')} hint={tr('兼容服务专用')}>
                        <textarea
                          className="code-input"
                          value={p.extra}
                          onChange={(e) => update('extra', e.target.value)}
                          spellCheck={false}
                        />
                        <small>{tr('可覆盖可选字段；未知参数由服务商决定是否支持。')}</small>
                      </Field>
                      <button className="subtle" onClick={() => setRequestView(true)}>
                        <Copy size={14} />
                        {tr('查看实际请求')}
                      </button>
                    </div>
                  )}
                  {error && (
                    <div className="error-box" role="alert">
                      <Info size={16} />
                      <span>{tr(error)}</span>
                    </div>
                  )}
                  <button className="generate-button" disabled={busy} onClick={generate}>
                    {busy ? (
                      <LoaderCircle size={18} className="spin" />
                    ) : (
                      <ArrowUpRight size={19} />
                    )}
                    <span>{busy ? tr('画面正在成形…') : tr('开始创作')}</span>
                    <kbd>{busy ? elapsed + 's' : '⌘ ↵'}</kbd>
                  </button>
                  {busy ? (
                    <button className="cancel-button" onClick={() => abort.current?.abort()}>
                      {tr('停止等待 · 可能仍产生费用')}
                    </button>
                  ) : (
                    <div className="generate-note">
                      <ShieldCheck size={12} />
                      {poll
                        ? tr('使用你的 Pollen · 费用以官方模型价格为准')
                        : tr('密钥仅在本次会话使用，不写入本地存储')}
                    </div>
                  )}
                </div>
              </section>
              <section className="canvas-area">
                <div className="canvas-top">
                  <div className="canvas-tabs">
                    <button className="selected">
                      {results.length || busy ? tr('本次创作') : tr('创作画布')}
                      <span>{results.length ? String(results.length).padStart(2, '0') : '01'}</span>
                    </button>
                    <button onClick={() => setPage('library')}>
                      {tr('最近作品')}
                      {works.length > 0 && <span>{works.length}</span>}
                    </button>
                  </div>
                  <span className="canvas-hint">
                    <span className={'status-dot ' + (busy ? 'connected' : '')} />
                    {busy ? tr('正在创作') : tr('准备就绪')}
                  </span>
                </div>
                {busy || results.length > 0 ? (
                  <div className="result-area">
                    {busy && (
                      <div className="progress-card">
                        {partial ? (
                          <img src={partial} alt={tr('流式生成预览')} />
                        ) : (
                          <div className="generating-art">
                            <div />
                            <div />
                            <div />
                          </div>
                        )}
                        <div className="progress-caption">
                          <LoaderCircle size={17} className="spin" />
                          <span>{tr(status)}</span>
                          <small>{elapsed}s</small>
                        </div>
                      </div>
                    )}
                    <div className="results-grid">{results.map(workCard)}</div>
                    {!busy && (
                      <div className="complete-caption">
                        <Check size={15} />
                        {tr('已自动保存到本地作品库')}
                        <button
                          onClick={() => {
                            setResults([]);
                            setError('');
                          }}
                        >
                          {tr('回到灵感画布')}
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="editorial-hero">
                      <img src="/images/ceramic.jpg" alt={tr('暖色光线下的手工陶瓷静物')} />
                      <div className="hero-top">
                        <span>
                          <span />
                          {tr('今日灵感 · DAILY INSPIRATION')}
                        </span>
                        <span>NO. 001</span>
                      </div>
                      <div className="hero-bottom">
                        <div>
                          <span>STILL LIFE STUDY</span>
                          <h2>
                            {tr('留一点空白，')}
                            <br />
                            {tr('让光照进来。')}
                          </h2>
                          <p>{tr('陶器、自然光，与安静的日常。')}</p>
                        </div>
                        <button onClick={() => useIdea(inspirations[0])}>
                          {tr('以此为灵感')}
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                      <span className="demo-label">{tr('灵感示例 · 非本次生成')}</span>
                    </div>
                    <div className="canvas-empty-note">
                      <span className="mini-orbit">✳</span>
                      <div>
                        <strong>{tr('你的下一幅作品，从这里开始')}</strong>
                        <p>{tr('在左侧写下想法，剩下的交给想象力。')}</p>
                      </div>
                      <span className="dashed-arrow">↰</span>
                    </div>
                    <div className="inspiration-heading">
                      <h3>
                        {tr('换个角度，找点灵感')}
                        <span>CURATED IDEAS</span>
                      </h3>
                      <button className="text-link" onClick={() => setPage('inspiration')}>
                        {tr('查看全部')}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                    <div className="inspiration-cards">
                      {inspirations.slice(1).map((idea) => (
                        <button className="idea-card" key={idea.id} onClick={() => useIdea(idea)}>
                          <div>
                            <img src={'/images/' + idea.id + '.jpg'} alt={idea.title} />
                            <span>
                              <ArrowUpRight size={16} />
                            </span>
                          </div>
                          <strong>{idea.title}</strong>
                          <small>{idea.tag}</small>
                        </button>
                      ))}
                    </div>
                    <div className="canvas-foot">
                      <span>{tr('为每一种想法，保留可能。')}</span>
                      <span>IMAGINATION, MADE VISIBLE.</span>
                    </div>
                  </>
                )}
              </section>
            </div>
          ) : page === 'library' ? (
            <section className="library-section">
              <div className="collection-toolbar">
                <div className="filter-tabs">
                  {['all', 'favorites'].map((t) => (
                    <button
                      className={filter === t ? 'active' : ''}
                      onClick={() => setFilter(t)}
                      key={t}
                    >
                      {t === 'all' ? tr('全部') : tr('收藏')}
                      <span>
                        {t === 'all' ? works.length : works.filter((x) => x.favorite).length}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="collection-actions">
                  <div className="search-field">
                    <Search size={15} />
                    <input
                      placeholder={tr('搜索描述或模型')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <IconButton title={tr('网格视图')} onClick={() => setLayout('grid')}>
                    <Grid2X2 size={17} />
                  </IconButton>
                  <IconButton title={tr('列表视图')} onClick={() => setLayout('list')}>
                    <LayoutList size={17} />
                  </IconButton>
                  <IconButton title={tr('清空作品库')} onClick={() => setConfirmClear(true)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
              {visibleWorks.length ? (
                <div className={'library-grid ' + layout}>{visibleWorks.map(workCard)}</div>
              ) : (
                <div className="empty-library">
                  <FolderOpen size={45} strokeWidth={1} />
                  <h2>{search ? tr('没有找到匹配的作品') : tr('给想象留一个位置')}</h2>
                  <p>
                    {search
                      ? tr('试着换一个关键词。')
                      : tr('生成的作品会自动收藏于此，仅存储在当前浏览器。')}
                  </p>
                  <button
                    className="primary"
                    onClick={() => {
                      setPage('studio');
                      setSearch('');
                    }}
                  >
                    {tr('开始第一幅创作')}
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="inspiration-page">
              <div className="editorial-intro">
                <span>THE ATELIER JOURNAL</span>
                <p>
                  {tr('不必从空白开始。')}
                  <br />
                  <em>{tr('选一种感觉，把它变成你的画面。')}</em>
                </p>
              </div>
              <div className="journal-grid">
                {inspirations.map((idea, i) => (
                  <article key={idea.id}>
                    <button
                      onClick={() =>
                        setPreview({ ...idea, src: '/images/' + idea.id + '.jpg', demo: true })
                      }
                    >
                      <img src={'/images/' + idea.id + '.jpg'} alt={idea.title} />
                      <span>0{i + 1}</span>
                    </button>
                    <div>
                      <small>{idea.en}</small>
                      <h2>{idea.title}</h2>
                      <p>{idea.prompt}</p>
                      <button className="subtle" onClick={() => useIdea(idea)}>
                        {tr('使用这段描述')}
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <p className="muted">
                {tr(
                  '灵感展示素材：陶瓷场景为生成式示例；其余摄影来自 Unsplash。示例不代表当前接口的实际输出。',
                )}
              </p>
            </section>
          )}
          <footer className="page-footer publication-footer">
            <div>
              <span>
                {tr('未形 ATELIER')} / {tr('为创作而留白')}
              </span>
              <a href="https://pollinations.ai" target="_blank" rel="noopener noreferrer">
                Powered by Pollinations ↗
              </a>
              <small>{tr('独立应用，非官方产品。')}</small>
            </div>
            <div className="footer-links">
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  openLegal('privacy');
                }}
              >
                {tr('隐私说明')}
              </a>
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  openLegal('terms');
                }}
              >
                {tr('使用与费用')}
              </a>
              {account.info.sourceUrl && (
                <a href={account.info.sourceUrl} target="_blank" rel="noreferrer">
                  {tr('查看源码')}
                </a>
              )}
              <button onClick={() => setHelp(true)}>
                {tr('使用指南')}
                <ArrowUpRight size={12} />
              </button>
            </div>
          </footer>
        </main>
      </div>
      {walletOpen && (
        <Modal
          title={tr('连接 Pollen 钱包')}
          subtitle={tr('由 Pollinations 安全处理授权。')}
          onClose={() => setWalletOpen(false)}
        >
          <WalletPanel
            account={account}
            busy={busy}
            onCustom={() => {
              setWalletOpen(false);
              openSettings();
            }}
            onPrivacy={() => openLegal('privacy')}
            onTerms={() => openLegal('terms')}
          />
        </Modal>
      )}
      {legal && (
        <Modal
          title={legal === 'privacy' ? tr('隐私说明') : tr('使用与费用')}
          onClose={closeLegal}
          wide
        >
          <PolicyContent kind={legal} info={account.info} />
        </Modal>
      )}
      {settings && (
        <Modal
          title={tr('连接你的创作工具')}
          subtitle={tr('使用 OpenAI 或兼容 Images API 的服务。')}
          onClose={() => setSettings(false)}
        >
          <div className="modal-body">
            <div className="security-notice">
              <ShieldCheck size={19} />
              <span>
                {tr(
                  'API Key 仅在当前页面内存中保存。请求经本站后端转发到你填写的地址；只连接你信任的服务。',
                )}
              </span>
            </div>
            <div className="two-cols" style={{ marginBottom: 18 }}>
              <button
                className="secondary"
                onClick={() => setDraft({ ...draft, base: 'https://api.openai.com/v1' })}
              >
                OpenAI
              </button>
              <button
                className="secondary"
                onClick={() =>
                  setDraft({
                    ...draft,
                    base: 'https://gen.pollinations.ai/v1',
                    organization: '',
                    project: '',
                  })
                }
              >
                Pollinations
              </button>
            </div>
            <Field label="Base URL">
              <input
                value={draft.base}
                onChange={(e) => setDraft({ ...draft, base: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
              <small>
                {tr('填写含版本号的基础地址，不要附加 /images/generations。仅支持公网 HTTPS。')}
              </small>
            </Field>
            <Field label="API Key">
              <input
                type="password"
                autoComplete="off"
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                placeholder="sk-…"
              />
            </Field>
            <div className="two-cols">
              <Field label="Organization" hint={tr('可选')}>
                <input
                  value={draft.organization}
                  onChange={(e) => setDraft({ ...draft, organization: e.target.value })}
                  placeholder="org-…"
                />
              </Field>
              <Field label="Project" hint={tr('可选')}>
                <input
                  value={draft.project}
                  onChange={(e) => setDraft({ ...draft, project: e.target.value })}
                  placeholder="proj_…"
                />
              </Field>
            </div>
            <p className="notice">
              {tr(
                '连接检测调用 GET /models，不生成图片。部分兼容服务不提供此接口，检测失败不一定代表无法生图。',
              )}
            </p>
            {connection && (
              <div className="connection-result" role="status">
                {tr(connection)}
              </div>
            )}
          </div>
          <footer className="modal-footer">
            <button className="subtle" disabled={testing || !draft.key} onClick={testConnection}>
              {testing ? <LoaderCircle size={16} className="spin" /> : <Link size={16} />}
              {tr('检测连接')}
            </button>
            <button
              className="primary"
              onClick={() => {
                try {
                  const u = new URL(draft.base);
                  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash)
                    throw new Error();
                  setConfig({
                    ...draft,
                    base: draft.base.replace(/\/$/, ''),
                    key: draft.key.trim(),
                  });
                  if (isPollinations(draft.base)) {
                    setP((s) => pollinationsDefaults(s));
                    if (mode === 'variations') setMode('generations');
                    setMask(null);
                  }
                  if (!isPollinations(draft.base) && poll) setP({ ...defaults });
                  setSettings(false);
                  notify(draft.key ? tr('接口已配置，开始创作吧') : tr('接口凭据已清除'));
                } catch {
                  setConnection(tr('请输入正确的公网 HTTPS 基础地址'));
                }
              }}
            >
              {tr('保存配置')}
              <ArrowRight size={16} />
            </button>
          </footer>
        </Modal>
      )}
      {drawMask && files[0] && (
        <MaskEditor file={files[0]} onSave={setMask} onClose={() => setDrawMask(false)} />
      )}
      {preview && (
        <Modal
          title={preview.demo ? preview.title : tr('作品详情')}
          subtitle={
            preview.demo
              ? tr('灵感示例 / 点击使用描述开始创作')
              : `${preview.model} · ${preview.size} · ${preview.duration}s`
          }
          onClose={() => setPreview(null)}
          wide
        >
          <div className="detail-grid">
            <div className="detail-image">
              <img src={preview.src} alt={preview.prompt} />
            </div>
            <div className="detail-content">
              <div className="eyebrow">THE IDEA BEHIND IT</div>
              <p>{preview.prompt}</p>
              <button
                className="subtle"
                onClick={() => {
                  navigator.clipboard
                    .writeText(preview.prompt)
                    .then(() => notify(tr('描述已复制')))
                    .catch(() => notify(tr('复制失败，请手动选择描述')));
                }}
              >
                <Copy size={14} />
                {tr('复制描述')}
              </button>
              {preview.revised_prompt && (
                <details>
                  <summary>{tr('模型改写的提示词')}</summary>
                  <p>{preview.revised_prompt}</p>
                </details>
              )}
              {preview.usage && (
                <details>
                  <summary>
                    {tr('Token 使用量 ·')} {preview.usage.total_tokens ?? tr('详情')}
                  </summary>
                  <pre>{JSON.stringify(preview.usage, null, 2)}</pre>
                </details>
              )}
              {preview.requestId && (
                <small className="muted">Request ID: {preview.requestId}</small>
              )}
              <div className="detail-buttons">
                {preview.demo ? (
                  <button className="primary" onClick={() => useIdea(preview)}>
                    {tr('以此为灵感')}
                    <ArrowUpRight size={15} />
                  </button>
                ) : (
                  <>
                    <button className="primary" onClick={() => download(preview)}>
                      <Download size={16} />
                      {tr('下载原图')}
                    </button>
                    <button className="secondary" onClick={() => useAsReference(preview)}>
                      <Brush size={16} />
                      {tr('作为参考图编辑')}
                    </button>
                    <button
                      className="subtle"
                      onClick={() => {
                        setPrompt(preview.prompt);
                        if (preview.params) setP({ ...defaults, ...preview.params, extra: '{}' });
                        setMode('generations');
                        setPage('studio');
                        setPreview(null);
                      }}
                    >
                      <RotateCcw size={14} />
                      {tr('复用参数与描述')}
                    </button>
                    <div className="detail-last">
                      <button className="subtle" onClick={() => favorite(preview)}>
                        <Heart size={16} fill={preview.favorite ? 'currentColor' : 'none'} />
                        {preview.favorite ? tr('取消收藏') : tr('收藏作品')}
                      </button>
                      <IconButton title={tr('删除作品')} onClick={() => removeWork(preview)}>
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
      {requestView && (
        <Modal
          title={tr('实际请求参数')}
          subtitle={
            'POST /v1/images/' +
            mode +
            ' · ' +
            (mode === 'generations' ? 'application/json' : 'multipart/form-data')
          }
          onClose={() => setRequestView(false)}
        >
          <div className="modal-body">
            <pre className="request-code">
              {(() => {
                try {
                  return JSON.stringify(
                    {
                      ...buildPayload(p, mode, prompt || tr('（此处为你的画面描述）'), config.base),
                      ...(mode !== 'generations'
                        ? {
                            [f === 'd2' ? 'image' : 'image[]']: files.map((x) => x.name),
                            ...(mask && mode === 'edits' ? { mask: mask.name } : {}),
                          }
                        : {}),
                    },
                    null,
                    2,
                  );
                } catch (e) {
                  return e.message;
                }
              })()}
            </pre>
            <p className="muted">
              {tr(
                '凭据通过 Authorization 请求头转发，不出现在参数中。编辑接口使用文件上传，而非文件名字符串。',
              )}
            </p>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title={tr('关于未形 Atelier')}
          subtitle={tr('一个专注画面、不打扰灵感的创作工作室。')}
          onClose={() => setHelp(false)}
        >
          <div className="modal-body help-content">
            <p className="notice">
              {tr(
                '推荐使用 Pollinations 登录。你授权自己的 Pollen 预算，本站仅在服务器内存中保存受限令牌。若当前是未配置的预览，请先完成发布指南中的 App Key 和域名设置。',
              )}
            </p>
            <div className="doc-links">
              <a
                href="https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md"
                target="_blank"
                rel="noreferrer"
              >
                Pollinations BYOP
                <ExternalLink size={14} />
              </a>
              <a href="https://gen.pollinations.ai/docs" target="_blank" rel="noreferrer">
                Pollinations API
                <ExternalLink size={14} />
              </a>
            </div>
            <h3>{tr('01 / 连接接口')}</h3>
            <p>
              {tr(
                '在接口设置中填写 Base URL 和 API Key，然后选择模型。模型名称可直接输入，自定义模型默认使用 GPT Image 参数格式。',
              )}
            </p>
            <h3>{tr('02 / 开始创作')}</h3>
            <p>
              {tr(
                '文字生图适合从零开始；图像编辑支持最多 16 张参考图与一张蒙版；图像变体是 DALL·E 2 的历史接口。参数可用性、旧模型是否下线以及额度由实际服务商决定。',
              )}
            </p>
            <h3>{tr('03 / 你的隐私与作品')}</h3>
            <p>
              {tr(
                'Pollinations 登录会话可跨刷新使用，令牌只保存在服务器内存中。可选的自定义接口密钥仅保存在页面内存中，刷新后清除。作品与描述保存在当前浏览器，可在作品库删除；远程 URL 可能过期，请及时下载。',
              )}
            </p>
            <h3>{tr('文档依据 · 2026.09.19')}</h3>
            <div className="doc-links">
              {[
                [tr('生成图像'), 'generate'],
                [tr('编辑图像'), 'edit'],
                [tr('图像变体'), 'create_variation'],
              ].map(([title, url]) => (
                <a
                  key={url}
                  href={
                    'https://developers.openai.com/api/reference/python/resources/images/methods/' +
                    url
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {title}
                  <ExternalLink size={14} />
                </a>
              ))}
              <a
                href="https://platform.openai.com/docs/api-reference/images-streaming"
                target="_blank"
                rel="noreferrer"
              >
                {tr('流式事件')}
                <ExternalLink size={14} />
              </a>
            </div>
            <p className="notice">
              {tr(
                '本网站实现 Images API，不包含 Responses 对话生图。尚未配置真实密钥时不展示虚构生成结果。兼容服务的功能可能少于官方接口。',
              )}
            </p>
          </div>
        </Modal>
      )}
      {confirmClear && (
        <Modal
          title={tr('清空本地作品库？')}
          subtitle={tr('此操作不可撤销，建议先下载需要保留的作品。')}
          onClose={() => setConfirmClear(false)}
        >
          <footer className="modal-footer">
            <button className="secondary" onClick={() => setConfirmClear(false)}>
              {tr('取消')}
            </button>
            <button
              className="primary danger"
              onClick={async () => {
                try {
                  await library('clear');
                  setWorks([]);
                  setResults([]);
                  setConfirmClear(false);
                  notify(tr('本地作品库已清空'));
                } catch {
                  notify(tr('清除失败，请重试'));
                }
              }}
            >
              {tr('确认清空')}
            </button>
          </footer>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {tr(toast)}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
