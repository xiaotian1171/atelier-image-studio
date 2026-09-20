import { useEffect, useState, useCallback } from 'react';
import { tr } from './i18n.js';

export const POLLINATIONS_BASE = 'https://gen.pollinations.ai/v1';
export const DEFAULT_POLLINATIONS_MODEL = 'tongyi-mai/z-image-turbo';
const initial = {
  loading: true,
  authReady: false,
  allowCustomProviders: false,
  budget: 1,
  expiryDays: 7,
  missing: [],
  sourceUrl: '',
  contactUrl: '',
};
async function json(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Request failed');
  return data;
}
export function usePollinations() {
  const [info, setInfo] = useState(initial),
    [session, setSession] = useState({ authenticated: false }),
    [models, setModels] = useState([]),
    [catalogError, setCatalogError] = useState(''),
    [balance, setBalance] = useState(null),
    [walletError, setWalletError] = useState(''),
    [authError, setAuthError] = useState(''),
    [connecting, setConnecting] = useState(false);
  const loadCatalog = useCallback(async () => {
    setCatalogError('');
    try {
      const data = await json('/api/catalog');
      setModels(data.models || []);
    } catch (e) {
      setCatalogError(e.message);
    }
  }, []);
  const refreshBalance = useCallback(async () => {
    setWalletError('');
    try {
      const data = await json('/api/wallet');
      setBalance(data.balance);
    } catch (e) {
      setBalance(null);
      setWalletError(e.message);
    }
  }, []);
  const refreshSession = useCallback(async () => {
    try {
      const data = await json('/api/session');
      setSession(data);
      if (data.authenticated) await refreshBalance();
      else setBalance(null);
    } catch {
      setAuthError(tr('无法读取登录状态，请刷新页面。'));
    }
  }, [refreshBalance]);
  useEffect(() => {
    json('/api/app')
      .then((data) => setInfo({ ...data, loading: false }))
      .catch(() => {
        setInfo({ ...initial, loading: false });
        setAuthError(tr('无法读取发布配置，请稍后重试。'));
      });
    loadCatalog();
    refreshSession();
    const url = new URL(window.location.href),
      status = url.searchParams.get('auth');
    const errors = {
      state_error: '授权状态不匹配或已过期，请重新登录。',
      denied: '你取消了授权。未连接 Pollen 钱包。',
      invalid_code: '授权码无效，请重新登录。',
      exchange_error: '无法完成授权码交换，请检查 App Key 和回调地址后重试。',
    };
    if (status) {
      if (errors[status]) setAuthError(tr(errors[status]));
      url.searchParams.delete('auth');
      history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  }, [loadCatalog, refreshSession]);
  async function connect() {
    if (!info.authReady) return;
    setConnecting(true);
    setAuthError('');
    try {
      const data = await json('/auth/start', {
        method: 'POST',
        headers: { 'x-atelier-request': '1' },
      });
      const url = new URL(data.url);
      if (url.origin !== 'https://enter.pollinations.ai')
        throw new Error(tr('授权地址异常，已停止登录。'));
      window.location.assign(url.href);
    } catch (e) {
      setAuthError(e.message);
      setConnecting(false);
    }
  }
  async function disconnect() {
    setAuthError('');
    try {
      await json('/auth/logout', { method: 'POST', headers: { 'x-atelier-request': '1' } });
      setSession({ authenticated: false });
      setBalance(null);
    } catch (e) {
      setAuthError(e.message);
    }
  }
  return {
    info,
    session,
    models,
    balance,
    walletError,
    authError,
    connecting,
    loadCatalog,
    refreshSession,
    refreshBalance,
    connect,
    disconnect,
    setAuthError,
  };
}
