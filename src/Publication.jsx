import React from 'react';
import {
  ExternalLink,
  ShieldCheck,
  ArrowUpRight,
  LoaderCircle,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { tr } from './i18n.js';

const External = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
    <ExternalLink size={12} />
  </a>
);
export function WalletPanel({ account, onCustom, onPrivacy, onTerms, busy }) {
  const { info, session, balance, walletError, authError, connecting } = account;
  return (
    <div className="wallet-content">
      <div className="wallet-intro">
        <span className="pollen-mark">✳</span>
        <div>
          <h3>{tr('你的 Pollen，你来掌控。')}</h3>
          <p>{tr('登录 Pollinations，授权使用自己的 Pollen。无需粘贴私密密钥。')}</p>
        </div>
      </div>
      <div className="wallet-disclosure">
        <ShieldCheck size={18} />
        <div>
          <strong>{tr('只申请创作所需的授权')}</strong>
          <p>
            {tr(
              '登录使用授权码与 PKCE，不申请账户管理、个人资料或用量明细权限。你可在官方授权页调整预算与有效期，并随时在官方后台撤销。',
            )}
          </p>
        </div>
      </div>
      {info.loading ? (
        <p className="notice">{tr('正在读取登录配置…')}</p>
      ) : !info.authReady ? (
        <div className="setup-notice" role="status">
          <strong>{tr('发布前还需要完成配置')}</strong>
          <p>
            {tr(
              '此预览尚未设置 App Key 或正式域名，因此不能进行真实登录。运营者需要在 Pollinations 注册 App Key，并配置以下环境变量。',
            )}
          </p>
          <code>{info.missing.join(' · ') || 'PUBLIC_APP_URL · POLLINATIONS_APP_KEY'}</code>
          {info.redirectUri && (
            <p>
              {tr('需登记的回调地址：')}
              <code>{info.redirectUri}</code>
            </p>
          )}
          <External href="https://enter.pollinations.ai/keys">{tr('创建公开 App Key')}</External>
        </div>
      ) : null}
      {session.authenticated ? (
        <>
          <div className="wallet-balance">
            <div>
              <span>{tr('可用授权额度')}</span>
              <strong>
                {balance === null
                  ? '—'
                  : Number(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                <small> Pollen</small>
              </strong>
            </div>
            <button
              className="icon-btn"
              aria-label={tr('刷新额度')}
              onClick={account.refreshBalance}
            >
              <RefreshCw size={17} />
            </button>
          </div>
          <p className="muted">
            {tr('本地登录有效至：')}
            {new Date(session.expiresAt).toLocaleString()}
          </p>
          {walletError && <p className="notice">{tr(walletError)}</p>}
          <div className="wallet-actions">
            <button className="secondary" onClick={account.disconnect} disabled={busy}>
              <LogOut size={15} />
              {tr('断开本次登录')}
            </button>
            <External href="https://enter.pollinations.ai/keys">{tr('管理或撤销授权')}</External>
          </div>
          <p className="muted">
            {tr(
              '断开登录会删除本站保存的会话令牌，但不会撤销官方后台中的授权密钥。彻底撤销请使用上方链接。',
            )}
          </p>
        </>
      ) : (
        <>
          <div className="consent-summary">
            <span>
              {tr('建议授权预算')}
              <b>{info.budget} Pollen</b>
            </span>
            <span>
              {tr('建议授权有效期')}
              <b>
                {info.expiryDays} {tr('天')}
              </b>
            </span>
          </div>
          <button
            className="primary wallet-connect"
            disabled={!info.authReady || connecting || busy}
            onClick={account.connect}
          >
            {connecting ? <LoaderCircle size={17} className="spin" /> : <ArrowUpRight size={17} />}{' '}
            {tr('使用 Pollinations 登录')}
          </button>
        </>
      )}
      {authError && (
        <div className="error-box" role="alert">
          {tr(authError)}
        </div>
      )}
      <p className="wallet-cost">
        {tr(
          '生成图片会消耗你自己的 Pollen，并非无限免费。实际费用按所选模型及 App Key 的可能加价计算；授权预算以官方确认页为准。本站不会自动重试付费请求。',
        )}
      </p>
      <div className="wallet-links">
        <button onClick={onPrivacy}>{tr('隐私说明')}</button>
        <button onClick={onTerms}>{tr('使用与费用')}</button>
        <External href="https://enter.pollinations.ai/models">{tr('查看官方模型与价格')}</External>
      </div>
      {info.allowCustomProviders && (
        <details className="custom-provider-details">
          <summary>{tr('高级：其他 API 服务')}</summary>
          <p>
            {tr(
              '仅在运营者启用时提供。自定义接口模式与 Pollinations 钱包登录互相独立，授权令牌绝不会转发给其他服务商。',
            )}
          </p>
          <button className="secondary" onClick={onCustom}>
            {tr('配置自定义接口')}
          </button>
        </details>
      )}
    </div>
  );
}
export function PolicyContent({ kind, info }) {
  return (
    <div className="modal-body policy-content">
      <p className="policy-version">{tr('更新日期：2026 年 9 月 19 日')}</p>
      {kind === 'privacy' ? (
        <>
          <h3>{tr('登录与凭据')}</h3>
          <p>
            {tr(
              '官方登录后取得的受限用户令牌仅保存在本站服务器内存中，不发送给前端脚本、不写入浏览器存储、URL 或应用日志。浏览器仅保存 HttpOnly、SameSite 会话 Cookie；正式 HTTPS 部署同时启用 Secure。会话最长 12 小时，或在授权更早到期时结束；重启服务器也会退出登录。',
            )}
          </p>
          <h3>{tr('图片与描述如何处理')}</h3>
          <p>
            {tr(
              '点击生成或编辑后，描述与参考图通过本站后端发送给 Pollinations 及其模型服务商处理。上传的参考图临时保存在服务器，请求结束后删除；异常中断遗留文件应由运营者清理。我们不建立服务器作品库。',
            )}
          </p>
          <p>
            {tr(
              '生成的作品与描述保存在当前浏览器的 IndexedDB；语言偏好保存在 localStorage。你可以在作品库删除、清空，或清除浏览器站点数据。远程图片 URL 可能被持有链接的人访问，也可能过期，不适合用于严格保密内容。',
            )}
          </p>
          <h3>{tr('第三方与运营日志')}</h3>
          <p>
            {tr(
              '本应用代码不集成广告、分析或追踪 SDK。托管商、反向代理及 Pollinations 可能根据其自身政策处理连接日志和内容。运营者应关闭对授权回调查询串、Cookie、请求体和凭据头的日志记录。',
            )}
          </p>
          <h3>{tr('删除与撤销')}</h3>
          <p>
            {tr(
              '断开登录删除本站会话；在 Pollinations 官方密钥后台撤销授权可立即阻止该授权继续使用。清空本地作品不会删除服务商持有的副本；第三方保留规则请查看其政策。',
            )}
          </p>
        </>
      ) : (
        <>
          <h3>{tr('费用与预算')}</h3>
          <p>
            {tr(
              '这是使用个人 Pollen 余额的创作工具，不承诺免费或无限额度。登录时你可以批准、调整或拒绝官方授权预算。模型费率、可用额度及可能的开发者加价由 Pollinations 管理；请在官方页面确认后使用。',
            )}
          </p>
          <h3>{tr('创作与权利')}</h3>
          <p>
            {tr(
              '只上传和处理你有权使用的内容，遵守 Pollinations、模型服务商及适用法律的要求。不得用于诈骗、侵权或违法用途。你应自行检查生成结果及使用权利，本站不保证内容准确、唯一或适合特定用途。',
            )}
          </p>
          <h3>{tr('请求、取消与可用性')}</h3>
          <p>
            {tr(
              '点击开始创作会发起可能收费的请求。停止等待不保证服务商停止处理或退还费用；本站不自动重试生图。模型目录、能力与价格可能变化；临时服务错误不代表平台收录或背书。',
            )}
          </p>
          <h3>{tr('独立项目')}</h3>
          <p>
            {tr(
              'Atelier 是基于 Pollinations API 的独立应用，不是 Pollinations 官方产品，也不声称已获得收录、认证或背书。灵感区示例不代表你当前接口的真实生成结果。',
            )}
          </p>
        </>
      )}
      <div className="policy-external">
        <External href="https://pollinations.ai">Pollinations</External>
        <External href="https://enter.pollinations.ai/keys">{tr('管理或撤销授权')}</External>
        <External href="https://enter.pollinations.ai/models">{tr('查看官方模型与价格')}</External>
        {info.sourceUrl && <External href={info.sourceUrl}>{tr('查看源码')}</External>}
        {info.contactUrl ? (
          <External href={info.contactUrl}>{tr('联系运营者')}</External>
        ) : (
          <span className="muted">{tr('此预览尚未配置运营者联系方式。')}</span>
        )}
      </div>
    </div>
  );
}
