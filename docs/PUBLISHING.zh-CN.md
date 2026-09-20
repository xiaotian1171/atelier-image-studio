# Atelier：Pollinations 收录准备与发布指南

核对日期：**2026-09-19**。本次准备的是「可提交到社区应用目录的版本」，不是替你提交，也不是已获官方收录。

## 一、官方现在究竟要求什么

### A. 官方提交模板明确写出的要求

依据：[官方 app-submission.yml](https://github.com/pollinations/pollinations/blob/main/.github/ISSUE_TEMPLATE/app-submission.yml)。

| 官方要求                     | 本项目的对应处理                                                      | 当前状态                       |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------ |
| 应用必须能实际工作           | 真实 Images API 调用；没有假登录、假生图；未配置时明确禁用 OAuth      | 代码已完成，真实账号验收待完成 |
| 明显使用 Pollinations        | 默认服务改为 Pollinations；官方钱包登录为主入口；实时读取图像模型目录 | 已实现                         |
| 明确用途                     | 文生图、参考图编辑、本地作品管理的图像工作室                          | 已实现                         |
| Credit Pollinations          | 顶栏和页脚可见 `Powered by Pollinations`，链接到官网                  | 已实现                         |
| 避免垃圾信息、诈骗、欺骗行为 | 不声称无限免费，不冒充官方产品，不把灵感示例当作当前结果              | 已实现                         |
| 公开的 App URL 供审核者试用  | 需要你部署正式 HTTPS 网址                                             | **未提供**                     |
| App Name / Description       | 已准备英文提交文案                                                    | 已准备                         |
| App Category                 | `image`                                                               | 已确定                         |
| App Language（ISO 代码）     | 主语言填 `en`，描述注明中文也可用                                     | 已准备                         |
| GitHub Repository URL        | 当前模板是**可选项**，不是强制开源                                    | 等你决定/填写                  |
| Discord Username             | 当前模板是可选联系信息                                                | 等你决定/填写                  |

模板说明：先有自动预审，再由维护者决定是否发表。**满足技术条件不保证收录。**

### B. 官方集成文档推荐的新网页应用接入方式

依据：[Connect User Wallets / BYOP](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md)、[API docs](https://github.com/pollinations/pollinations/blob/main/APIDOCS.md)。

- App Key 是公开的 `pk_…` OAuth 客户端标识，需要登记回调 URI。
- 新网页集成推荐 **Authorization Code + PKCE S256**。
- 校验 `state`，然后交换短时、一次性的授权码。
- 服务器应用在后端完成令牌交换。
- 使用授权后获得的受限用户令牌调用 API，不用原始 `pk_` 直接发起新浏览器生图集成。
- 不要把长期私密 `sk_` 发布到代码、仓库或网页。
- 授权令牌不要写入 localStorage、URL、分析系统或日志。
- 生图本身不需要账户 profile / usage / keys 权限；预算及到期时间由授权限定。
- 不提供 refresh token；过期后重新登录。

**注意区分：**BYOP 是官方推荐/支持的接入路径，不应把它描述成当前简短收录模板中的独立硬性字段。本次为了让公开应用更符合官方方向，已经采用它作为主路径。

### C. 本次额外做的工程与透明度改进

隐私页、费用页、Docker、安全响应头、服务端令牌隔离、测试、上线清单是本次提供的工程措施，**不冒称它们都是官方目录的强制条款**。

## 二、这次改了什么

1. **默认进入 Pollinations 创作流程**，而非让普通用户先填写 OpenAI Key。
2. 增加「Sign in with Pollinations」钱包面板；预算、有效期、费用和撤销入口可见。
3. OAuth 使用实时 discovery、PKCE、一次性 state、服务端授权码交换和随机会话 ID。
4. 受限用户令牌仅放服务器内存；浏览器仅持有 HttpOnly Cookie，公开 HTTPS 部署加 Secure。
5. 默认请求 **1 Pollen 建议预算、7 天建议授权期限**；用户在官方页面的确认设置为准。本站会话最多 12 小时或更早授权到期；重启即退出。
6. 不请求账户管理、个人资料或用量明细权限。预算密钥可读取剩余额度；若服务商不允许读取，界面说明而不是伪造余额。
7. 授权后请求强制走 `https://gen.pollinations.ai/v1`，不能被自定义 Base URL 偷换目的地。
8. 显示官方实时模型目录、是否支持参考图、已公开的参考数量上限及分辨率选项；后端再次检查编辑能力。
9. 明确隐藏/禁用 Pollinations 文档未列出的 masks、variations、streaming 等功能，不做「全兼容」误导。
10. 页头/页脚加入官方署名链接，增加独立应用说明。
11. 加入 `/privacy`、`/terms` 双语说明，继续默认英文，并记住语言选择。
12. 原本的自定义 OpenAI 接口能力保留为**运营者显式开启的高级功能**，默认关闭，避免把发布版变成开放转发器。
13. 准备部署文件、测试和英文提交草稿。

## 三、你还需要提供的两项核心配置

目前你选择了「先准备发布版本」，并且还没有 App Key。因此真实登录被明确禁用，这是预期行为，不是成功授权的演示。

### 1. 正式 HTTPS 网址

你需要一个可公开访问的部署，例如自己的域名或托管平台分配的稳定 HTTPS 域名。

- 这个版本需要 Node.js 后端，不是纯静态 GitHub Pages 站点。
- Arena 临时预览可以看界面，但不应作为长期提交地址。
- 「官方应用收录」与「官方托管你的服务器」不是同一件事。不要假定提交目录就自动获得服务器托管。
- 本项目支持根路径部署，暂不支持 `https://example.com/some/subpath`。

### 2. 创建公开 App Key

访问 <https://enter.pollinations.ai/keys>：

1. 使用你自己的账号登录。
2. 选择创建 **App Key**，名称建议 `Atelier — Image Studio`。
3. 登记精确的 Redirect URI：

```text
https://你的正式域名/auth/callback
```

4. 保存得到的公开 `pk_…` App Key。
5. 在服务器环境变量中填写：

```dotenv
PUBLIC_APP_URL=https://你的正式域名
POLLINATIONS_APP_KEY=你创建的公开pk_值
POLLINATIONS_BUDGET=1
POLLINATIONS_EXPIRY_DAYS=7
ENABLE_CUSTOM_PROVIDERS=false
```

这里的中文占位文本不能原样复制到生产配置。**不要把 `sk_` 私密密钥填到 App Key 字段，也不要给我发送私密 Key。**

`.env.example` 中必需项默认留空，避免未配置时误装成可用。

## 四、部署

### 常规 Node 部署

```bash
npm ci
cp .env.example .env
# 编辑 .env
npm run build
npm start
```

线上通过 HTTPS 反向代理访问。官方 OAuth 页面应在独立浏览器标签页中打开，不要依赖嵌入式预览 iframe。

### Docker

```bash
cp .env.example .env
# 编辑 .env
docker compose up -d --build
```

Compose 默认只绑定服务器的 `127.0.0.1:3000`。使用 `docs/nginx.example.conf` 作为反向代理参考，替换域名和证书路径后再部署。

容器以非 root 运行，根文件系统只读，上传目录位于临时 `/tmp`。Docker 配置已提供，**当前沙箱未实际执行 Docker 构建/部署**。

### 必须注意的运维边界

- 当前是**单实例内存会话**，重启会退出登录。不要直接开多副本轮询；扩容前需设计安全的共享会话存储与令牌加密。
- OAuth 回调中的 `code` 是一次性凭据。应用不记录它，但 CDN / 反向代理 / APM 也必须避免记录完整回调查询串、Cookie、Authorization、请求体。
- 只有在确实存在一个可信反向代理且它会覆盖转发头时，才设置 `TRUST_PROXY_HOPS=1`；不要随意信任来源可伪造的 IP 头。
- 配置生产 TLS，确保 Cookie 带 Secure / HttpOnly / SameSite。
- 当前代码不是完整商业平台的安全审计结果。公开运营前仍需确认流量限制、临时磁盘限制、监控及你所在地区的合规要求。
- 可以设置 `PUBLIC_SOURCE_URL` 和 `PUBLIC_CONTACT_URL` 显示真实源码/联系入口；不要填写假链接。
- 生成请求不自动重试。停止等待不等于服务商取消计费。

可先运行 `npm run check:release` 检查配置；加上 `-- --live` 可检查正式网站的公开页面，不进行登录或付费调用。当前缺少域名和 App Key 时返回失败是正确的发布拦截，不是生图接口故障。

## 五、提交前必须亲自完成的验收

下面涉及账号/付费部分尚未完成，不能由模拟测试替代。

- [ ] 使用最终域名，打开 `/api/app`，确认 `authReady: true`、`missing: []`。
- [ ] 在浏览器新建无痕窗口，点官方登录按钮，能看到正确的 App 名称。
- [ ] 检查授权回调 URI 与 App Key 登记值完全一致。
- [ ] 在官方页面确认预算，回到应用后能显示 Pollen connected。
- [ ] 在浏览器 Network / Storage 检查，前端拿不到 `sk_` 授权令牌；Cookie 是 HttpOnly。
- [ ] 选择当前可用的低成本图像模型，做 **一次真实生成**；确认拿到图像、能下载、扣费与预期一致。
- [ ] 选一个支持参考图的模型，做 **一次真实编辑**。
- [ ] 测试余额不足、取消授权、授权过期等路径，不出现虚构成功结果。
- [ ] 断开登录后本站不能继续用该会话生图；在官方后台撤销后再次调用也应失败。
- [ ] 英文/中文、手机、作品删除、隐私页与费用页可用。
- [ ] 检查页脚署名链接、独立项目说明及联系信息。
- [ ] 关闭自定义服务商模式，或者确认你明确希望承担开启后的额外代理安全边界。
- [ ] 若启用开发者收益，在官方后台核对当前加价政策并确保费用说明准确。

## 六、如何提交官方收录

验收完成后，使用官方入口：

<https://github.com/pollinations/pollinations/issues/new?template=app-submission.yml>

把 `docs/APP-SUBMISSION.md` 的英文内容填写进去，补上真实 App URL；GitHub 仓库与 Discord 联系方式按需填写。截图不是当前模板列出的必填字段，但可以提供你实际部署、实际运行后的截图。

**不要现在就提交带未配置登录按钮的预览。** 官方模板要求工作中的应用。预审与维护者决定由官方负责，不能承诺收录或自动获得奖励。

## 七、官方依据

- 提交要求与字段：[app-submission.yml](https://github.com/pollinations/pollinations/blob/main/.github/ISSUE_TEMPLATE/app-submission.yml)
- 钱包接入与 PKCE：[BRING_YOUR_OWN_POLLEN.md](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md)
- API / key 类型 / model catalog / error envelope：[APIDOCS.md](https://github.com/pollinations/pollinations/blob/main/APIDOCS.md)
- 官方 OAuth discovery：<https://enter.pollinations.ai/.well-known/oauth-authorization-server>
- 模型目录：<https://gen.pollinations.ai/image/models>

要求和模型目录可能继续变化，实际提交当天建议再次检查官方模板与文档。
