# Atelier — Pollinations 图像工作室

[English](README.md) | **简体中文**

一个由 [Pollinations](https://pollinations.ai) 提供生成能力、界面简洁的双语图像工作室。支持文字生图、参考图编辑和浏览器本地作品库。界面默认英文，可从语言菜单切换为简体中文。

**线上地址：**<https://image.xt1171.eu.org> —— 已配置注册的公开 App Key，登录可用，用户消耗的是自己授权的 Pollen 余额。这是独立社区项目，不代表已获官方收录、官方背书，也不承诺免费使用。

- **官方要求对照与中文发布指南：**[docs/PUBLISHING.zh-CN.md](docs/PUBLISHING.zh-CN.md)
- **英文应用提交草稿：**[docs/APP-SUBMISSION.md](docs/APP-SUBMISSION.md)
- **测试与验证记录：**[docs/TESTING.md](docs/TESTING.md)

## 快速启动

需要 Node.js 20.19 或更高版本，推荐 Node.js 22 LTS。

```bash
npm ci
cp .env.example .env
npm run dev
# http://localhost:3000
```

没有 App Key 时，仍可查看创作界面、灵感图库、实时公开模型目录、本地作品库、语言切换和隐私/使用条款。登录面板会明确说明缺少哪些配置，不会伪造登录或生图结果。

生产模式：

```bash
npm ci
npm run build
npm start
```

服务器监听 `0.0.0.0:$PORT`，默认端口为 3000。前后端必须同源部署。本项目需要长期运行的 Node.js 服务，**不能仅作为静态页面部署到 GitHub Pages**。

## 配置 Pollinations 官方登录

1. 将应用部署到稳定的 HTTPS 地址，例如 `https://atelier.your-domain.com`。
2. 在 <https://enter.pollinations.ai/keys> 创建**公开 App Key**。它以 `pk_` 开头，用作 OAuth 客户端标识，**不是**直接用于生图的 Bearer Key。
3. 登记精确的回调地址：`https://atelier.your-domain.com/auth/callback`。
4. 填写以下环境变量，然后重启服务：

```dotenv
PUBLIC_APP_URL=https://atelier.your-domain.com
POLLINATIONS_APP_KEY=YOUR_REGISTERED_PUBLIC_PK_KEY
POLLINATIONS_BUDGET=1
POLLINATIONS_EXPIRY_DAYS=7
ENABLE_CUSTOM_PROVIDERS=false
```

前两项必须替换成你自己的真实部署信息。`YOUR_REGISTERED_PUBLIC_PK_KEY` 只是说明用占位符，不是有效密钥。随附的 `.env.example` 特意将这两项留空。

`PUBLIC_APP_URL` 必须是根地址，不得附带路径、查询参数或片段。仅本机回环测试地址允许使用 HTTP；本地测试 OAuth 时，也需要登记对应的回环回调地址。

### 授权设计

- 使用 OAuth 授权码流程、**PKCE S256** 和加密安全随机生成的一次性 `state`。
- 从 Pollinations OAuth 元数据发现端点，并将签发者和授权端点来源限定为 `https://enter.pollinations.ai`。
- 不申请个人资料、账户管理或历史用量权限。生图本身不需要账户 scope；授权密钥受用户批准的预算和有效期限制。
- 在后端完成授权码交换。
- 授权获得的 `sk_` 用户令牌**仅保存在服务器内存中**，不返回给前端 JavaScript，不写入 localStorage/sessionStorage、URL 或应用日志。
- 浏览器仅收到随机的 **HttpOnly、SameSite=Lax** 会话 Cookie；配置了 HTTPS 正式地址后启用 **Secure**。登录成功后更新会话 ID。
- 本站会话最长 12 小时，或在令牌更早到期时结束。服务器重启会退出所有登录。当前采用**单实例**部署；多副本需要额外设计安全的共享会话存储。
- 使用会话认证的生图请求强制发送给 Pollinations，不能通过自定义 Base URL、Organization 或 Project 把授权令牌转发到其他服务商。
- 断开登录会删除本站服务器会话，但**不会**撤销 Pollinations 后台中的授权密钥。界面提供官方管理/撤销入口。
- 带预算的授权密钥可以在没有 `usage` scope 的情况下读取剩余授权额度。若读取余额返回 403，界面会解释原因，而不是直接认定无法生图。
- 不使用 refresh token，也不自动重试可能收费的生图请求。

## 面向发布的功能

- 顶栏和页脚显示 **Powered by Pollinations**，并链接到官方站点。
- 明确声明这是独立项目，不声称已获官方收录或背书。
- 以官方登录作为主要入口，不要求普通用户粘贴长期私密 Key。
- 说明 Pollen 消耗、建议预算、授权期限、模型价格及 App Key 可能产生的加价。
- 提供 `/privacy` 和 `/terms` 两个地址，均支持英文和中文。
- 通过固定的后端端点读取 `/image/models` 实时公开模型目录。编辑需要同时具备图像输入能力与编辑端点支持；后端再次校验已公开的参考图数量限制。
- 对声明支持分辨率选项的模型展示对应控件。不提供 Pollinations 未支持或未公开说明的蒙版、变体、流式、压缩、透明背景、输入保真度等控件。
- 默认使用 `quality: medium`、`n: 1`、明确尺寸及 Pollinations 支持的请求字段，不照搬 OpenAI 专属默认参数。
- 作品库保存在浏览器 IndexedDB，支持下载、收藏、搜索、删除、清空和复用描述/参数。
- 参考图通过 multipart 上传；请求结束后删除服务器临时文件。异常退出留下的临时文件需要运营者清理。
- 切换界面语言**不会翻译或改写**用户输入、作品描述、模型 ID 或 API 参数值。

### 可选的自定义接口模式

原有 OpenAI 和兼容接口功能仅在运营者明确设置 `ENABLE_CUSTOM_PROVIDERS=true` 后开放，入口位于登录面板的高级设置中。该模式使用用户提供的 Key，并仅将它保存在页面内存中，与 Pollinations 会话相互独立。公开发布版默认关闭此功能。

可通过 `ALLOWED_API_HOSTS` 限制自定义接口的目标域名。转发路径仅允许公网 HTTPS，进行内网/保留 IP 过滤、固定已校验的 DNS 解析结果、禁止重定向，并使用端点白名单。这些措施不能代替完整的生产安全审查。

## Docker 部署

```bash
cp .env.example .env
# 填写必需配置，以及可选的源码/联系链接。
docker compose up -d --build
```

Compose 默认绑定 `127.0.0.1:3000`，供 HTTPS 反向代理访问。容器以非 root 用户运行，根文件系统只读，临时上传目录位于 `/tmp`。可参考 [docs/nginx.example.conf](docs/nginx.example.conf)，但必须先替换其中的域名与证书路径。

- `/healthz` 是无需认证的健康检查，不代表 OAuth 或付费调用已就绪。
- 只有在确实存在一个可信反向代理时，才设置 `TRUST_PROXY_HOPS=1`，并确保该代理会覆盖转发头。不要信任来自公网的任意 `X-Forwarded-For`。
- 允许较长的图像请求；使用可选 OpenAI SSE 时应关闭响应缓冲。
- 对齐代理层和应用层的上传限制。示例代理限制单次请求为 200 MB；应用层每个文件最多 50 MB，每次最多 17 个文件。
- CDN、托管层、WAF 和反向代理均不应记录 OAuth 回调查询串、Cookie/Authorization 头、请求体或私密凭据。
- 应用配置、会话与钱包端点使用 `Cache-Control: no-store`。
- 生产模式启用 CSP 和安全响应头。已配置的正式部署不用于嵌入第三方 iframe；请在独立浏览器标签页测试 OAuth。
- 大流量公开运营前，应补充基础设施级别的限流、请求大小限制和监控。当前应用限制包括：每 IP 最多 3 个并发生图/API 请求、每 IP 每 10 分钟最多 10 次登录发起、2,000 个会自动到期的服务器会话，以及 10 分钟的图像请求时限。

## 环境变量

| 变量 | 用途 |
|---|---|
| `PUBLIC_APP_URL` | 公开 HTTPS 根地址，用于确定需要登记的回调 URI |
| `POLLINATIONS_APP_KEY` | 公开的 `pk_` OAuth App Key；拒绝 `sk_` 值 |
| `POLLINATIONS_BUDGET` | 建议授权预算，默认 1 Pollen；以用户最终确认值为准 |
| `POLLINATIONS_EXPIRY_DAYS` | 建议授权期限，默认 7 天 |
| `PUBLIC_SOURCE_URL` | 可选的真实公开源码仓库链接 |
| `PUBLIC_CONTACT_URL` | 可选的运营者 HTTPS 或 mailto 联系链接，建议上线前填写 |
| `ENABLE_CUSTOM_PROVIDERS` | 默认关闭；启用独立的开发者/自定义接口模式 |
| `ALLOWED_API_HOSTS` | 自定义接口转发的可选域名白名单 |
| `TRUST_PROXY_HOPS` | 准确的可信代理跳数，默认 0 |
| `PORT` | 监听端口，默认 3000 |

开发者收益由 Pollinations 后台中的 App Key 设置控制，不由本项目代码决定。如果选择启用，应核实并披露平台当前加价规则。应用消耗用户 Pollen 时，不应宣称它是免费的。

## 发布检查

设置环境变量后，运行 `npm run check:release`。追加 `-- --live` 可以检查公开页面，但不会登录或消耗 Pollen。缺少域名或 App Key 时，检查按设计返回失败。

此检查不能替代真实 OAuth 授权和生图验收。

## 测试

```bash
npm test
# 33 项单元/集成测试，包含服务端 OAuth 模拟测试

# 先在 localhost:3000 启动网站，再运行：
npx playwright install --with-deps chromium
node tests/publication-browser.mjs
node tests/browser.mjs
node tests/pollinations-browser.mjs
node tests/language-browser.mjs
```

浏览器测试对付费调用和已登录界面状态使用模拟响应。服务端 OAuth 测试注入模拟 discovery/token 服务，覆盖 state、PKCE、Cookie、授权码重放、取消授权、令牌交换失败、会话和退出登录。原有自定义接口回归测试会显式模拟运营者已启用该功能的配置。

**线上部署已验证：**Docker 生产构建、Cloudflare 之后的 HTTPS 反向代理、`/healthz`、`/api/app` 返回 `authReady: true`、公开模型目录，以及针对已登记回调生成的授权跳转。

**尚未用真实账号验证：**在浏览器中完成 OAuth 同意、真实付费生成/编辑、服务商侧撤销授权，以及持续流量下的表现。这些需要真实用户会话，仍留在发布检查单上。

## 项目结构

```text
README.md                    默认英文说明
README.zh-CN.md              中文说明
server.js                    Express 转发与生产静态托管
server/pollinations.js       OAuth、服务器会话、固定的模型目录/余额端点
src/main.jsx                 工作台、蒙版、作品库、语言控件
src/api.js                   OpenAI/Pollinations 参数、SSE、本地存储
src/usePollinations.js       浏览器账户/模型目录状态，不接收授权令牌
src/Publication.jsx          授权说明、余额、隐私与使用条款
src/i18n.js + locales.json   中英文文案及语言偏好
Dockerfile + compose.yml     单实例部署模板
.env.example                 配置名称与说明，不含真实密钥
```

## 文档依据与素材

要求核对日期：**2026-09-19**。

- [官方应用提交模板](https://github.com/pollinations/pollinations/blob/main/.github/ISSUE_TEMPLATE/app-submission.yml)
- [官方 BYOP / 钱包接入指南](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md)
- [官方 API 文档](https://github.com/pollinations/pollinations/blob/main/APIDOCS.md)
- [OAuth discovery](https://enter.pollinations.ai/.well-known/oauth-authorization-server)

项目使用 React、Vite、Express 和 lucide-react。展示素材保存在本地，渲染工作台不依赖外部字体或图片 CDN。陶瓷场景是生成式灵感示例，不是当前 API 的真实返回。其余灵感摄影来自 Unsplash：

- https://images.unsplash.com/photo-1509316785289-025f5b846b35
- https://images.unsplash.com/photo-1600210492486-724fe5c67fb0
- https://images.unsplash.com/photo-1473116763249-2faaef81ccda

代码采用 ISC 许可证；第三方依赖和摄影素材保留各自的许可证或条款。Pollinations 名称仅用于准确署名，不代表拥有该品牌或获得官方背书。
