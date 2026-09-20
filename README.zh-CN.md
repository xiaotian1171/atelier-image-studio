# Atelier — Pollinations 图像工作室

[English](README.md) | **简体中文**

**线上地址：**<https://image.xt1171.eu.org> · **许可证：**ISC

一个由 [Pollinations](https://pollinations.ai) 提供生成能力、界面安静的双语图像工作室。写下描述就能生成图片，可以用参考图继续修改，作品保存在浏览器本地。

登录走 Pollinations 的 **Bring Your Own Pollen** 流程：用户授权自己的账号、自己确认消费上限，生图消耗的是用户自己的 Pollen 余额。运营者不持有任何生图密钥，也不需要替别人的生成付费。

## 功能

- **文字生图**：模型目录来自 Pollinations 的实时接口（服务端读取 `/image/models`，缓存 5 分钟）。
- **参考图编辑**：仅对声明支持图像输入和编辑端点的模型开放，后端会再次校验公开的参考图数量限制。
- **本地作品库**：存放在 IndexedDB，支持下载、收藏、搜索、删除、清空、复用描述与参数。
- **双语界面**：默认英文，可从语言菜单切换简体中文。用户输入、模型 ID 和 API 参数不会被翻译。
- **BYOP 登录**：OAuth 授权码流程 + PKCE S256。
- **费用透明**：展示建议预算、授权期限、模型价格链接，顶栏和页脚标注 Pollinations 署名。
- 提供中英文的 `/privacy` 与 `/terms` 页面。

## 环境要求

- Node.js **20.19+**（推荐 22 LTS）
- Docker + Docker Compose（走容器部署时需要）
- 一个**固定的 HTTPS 地址**才能让登录真正可用 —— OAuth 回调不接受明文 HTTP，只有本机回环地址例外

## 快速启动（开发）

```bash
npm ci
cp .env.example .env
npm run dev
# http://localhost:3000
```

没有配置 App Key 时，创作界面、灵感图库、实时模型目录、本地作品库、语言切换和条款页面都能正常打开，登录面板会明确告诉你缺哪几个变量，不会伪造登录或生图结果。

不用 Docker 的生产构建：

```bash
npm ci
npm run build
npm start
```

服务监听 `0.0.0.0:$PORT`（默认 3000），前后端同源。这是需要长期运行的 Node 服务，**不能**只当作静态站点丢到 GitHub Pages。

## 配置登录（BYOP App Key）

1. 先把应用部署到一个固定的 HTTPS 地址，例如 `https://atelier.example.com`。
2. 在 <https://enter.pollinations.ai/keys> 创建**公开 App Key**。它以 `pk_` 开头，作为 OAuth 客户端标识使用，**不是**用来生图的 Bearer Key（应用会拒绝 `sk_`）。
3. 登记精确的回调地址：`https://atelier.example.com/auth/callback`，必须一字不差。
4. 填写环境变量后重启：

```dotenv
PUBLIC_APP_URL=https://atelier.example.com
POLLINATIONS_APP_KEY=pk_你的公开AppKey
POLLINATIONS_BUDGET=1
POLLINATIONS_EXPIRY_DAYS=7
ENABLE_CUSTOM_PROVIDERS=false
TRUST_PROXY_HOPS=0
PORT=3000
```

`PUBLIC_APP_URL` 必须是根地址，不能带路径、查询参数或片段。只有回环地址（如 `http://127.0.0.1:3000`）才允许用 HTTP，方便本地调回调。

App Key 建好后不能修改：要换回调地址或名称，只能撤销重建。

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `PUBLIC_APP_URL` | 公开 HTTPS 根地址，决定你必须登记的回调 URI |
| `POLLINATIONS_APP_KEY` | 公开的 `pk_` App Key（OAuth 客户端标识），拒绝 `sk_` |
| `POLLINATIONS_BUDGET` | 建议授权预算（Pollen），默认 `1`；以用户在授权页确认的值为准 |
| `POLLINATIONS_EXPIRY_DAYS` | 建议授权期限（天），默认 `7`，范围 1–30 |
| `PUBLIC_SOURCE_URL` | 可选的公开仓库链接，显示在页脚 |
| `PUBLIC_CONTACT_URL` | 可选的 `https://` 或 `mailto:` 联系链接 |
| `ENABLE_CUSTOM_PROVIDERS` | 默认 `false`；启用独立的 OpenAI 兼容接口模式 |
| `ALLOWED_API_HOSTS` | 自定义接口转发的可选域名白名单 |
| `TRUST_PROXY_HOPS` | 可信代理跳数，默认 `0`；只有在正好一层会覆盖转发头的代理后面才设为 `1` |
| `PORT` | 监听端口，默认 `3000` |

开发者收益（若有）在 Pollinations 后台的 App Key 上配置，不由本项目代码控制。

## Docker 部署

```bash
cp .env.example .env
# 填好 PUBLIC_APP_URL 与 POLLINATIONS_APP_KEY
docker compose up -d --build
```

compose 默认把服务绑在 `127.0.0.1:3000`，供 TLS 反向代理访问。容器以非 root 用户运行，根文件系统只读，`cap_drop: ALL`、`no-new-privileges`，上传临时目录用 2 GB 的 tmpfs。

宿主 3000 端口被占用时，改映射的左侧即可（例如 `"127.0.0.1:3100:3000"`），再把代理指到新端口。

```bash
docker compose logs -f    # 看到 "Atelier is listening on 0.0.0.0:3000" 即启动完成
docker compose down
```

## 放在反向代理后面

从 [docs/nginx.example.conf](docs/nginx.example.conf) 改起，替换域名和证书路径。几个关键点：

- 转发到 `http://127.0.0.1:3000`；`X-Forwarded-For` 用 `$remote_addr` 覆盖（不要追加），并设置 `X-Forwarded-Proto $scheme`。
- 关闭缓冲（`proxy_buffering off`、`proxy_request_buffering off`），放宽超时（`proxy_read_timeout 620s`）。
- **不要**记录 OAuth 回调查询串、`Cookie`/`Authorization` 头或请求体 —— 回调里带着一次性 code。示例配置为此使用 `access_log off; error_log /dev/null crit;`。
- 各层上传限制要对齐：示例代理放行 200 MB/请求，应用层单文件 50 MB、单次最多 17 个文件。
- 只有确实存在一层可信代理时才设 `TRUST_PROXY_HOPS=1`，绝不要信任任意公网 `X-Forwarded-For`。

### Cloudflare（或同类 CDN）注意

- 域名指向源站、由 CDN 终止 TLS。源站监听 80 端口时，SSL 模式选 **灵活（Flexible）**；选 **完整 / 完整（严格）** 时 CDN 会去连源站的 **443**，如果那台机器 443 已经跑着别的服务就会失败。
- `/api/*`、`/auth/*`、`/api/session`、`/api/wallet` 不要进缓存。应用已经对这些路由发送 `Cache-Control: no-store`，确认 CDN 尊重它。
- OAuth 请在独立浏览器标签页里测。应用发送 `frame-ancestors 'self'`，不打算被第三方 iframe 嵌入。

## 健康检查与运维

- `GET /healthz` → `{"status":"ok"}`，无需认证，但**不**代表 OAuth 或计费已就绪。
- `GET /api/app` → 返回 `authReady`、`redirectUri`、`missing`、`budget`、`expiryDays`、`sessionHours`，是确认配置是否完整最快的方式。
- 会话保存在服务器内存，重启容器等于所有人退出登录。这是刻意设计的**单实例**方案；要多副本得自己接一套安全的共享会话存储。
- 应用层限制：每 IP 3 个并发生图/API 请求、每 IP 每 10 分钟 10 次登录发起、2000 个自动到期的会话、单次图像请求 10 分钟上限。公开运营前请再补基础设施级的限流与监控。

## 登录流程是怎么走的

1. 浏览器请求后端开始登录。后端生成 PKCE verifier 和一次性 `state`，只存在服务器内存里，返回授权地址。
2. 用户在 Pollinations 授权页确认消费上限。
3. Pollinations 跳回 `/auth/callback?code=…&state=…`。后端校验 `state` 并立即作废，然后用 PKCE 在**服务端**换取令牌。
4. 换来的 `sk_` 令牌只留在服务器内存。浏览器拿到的是一个随机的 `HttpOnly`、`SameSite=Lax` 会话 Cookie（HTTPS 地址下带 `Secure`），全程看不到令牌。
5. 带会话的生图请求被钉死在 `https://gen.pollinations.ai`，无法通过任何参数把授权令牌转发到别的服务商。
6. 会话最长 12 小时，或随令牌更早到期。断开登录只删除本站会话，**不会**撤销 Pollinations 后台里的授权，界面提供官方撤销入口。

不使用 refresh token，不自动重试可能收费的生图请求，也不申请个人资料、账户管理或历史用量权限。

## 可选的自定义接口模式

只有在运营者明确设置 `ENABLE_CUSTOM_PROVIDERS=true` 后，OpenAI 兼容接口功能才会出现，入口在登录面板的高级设置里。该模式使用用户自己提供的 Key，仅保存在页面内存中，与 Pollinations 会话相互独立。`ALLOWED_API_HOSTS` 用于限制目标域名。转发路径只允许公网 HTTPS，并做内网/保留 IP 过滤、固定已校验的 DNS 结果、禁止重定向和端点白名单 —— 这些仍不能代替完整的安全审查。

## 测试

```bash
npm test
# 33 项单元/集成测试，含服务端 OAuth 模拟测试

# 先在 localhost:3000 启动网站
npx playwright install --with-deps chromium
node tests/publication-browser.mjs
node tests/browser.mjs
node tests/pollinations-browser.mjs
node tests/language-browser.mjs
```

浏览器测试对付费调用和已登录状态使用模拟响应。服务端 OAuth 测试注入模拟 discovery/token 服务，覆盖 state、PKCE、Cookie、授权码重放、用户拒绝、令牌交换失败、会话与退出登录。`npm run check:release` 检查配置，加 `-- --live` 可检查公开页面。

## 项目结构

```text
server.js                    Express 转发、API 校验、生产静态托管
server/pollinations.js       OAuth、服务器会话、固定的模型目录/余额端点
src/main.jsx                 工作台、蒙版、作品库、语言控件
src/api.js                   请求参数、SSE、本地存储
src/usePollinations.js       浏览器侧账户/模型目录状态（拿不到令牌）
src/Publication.jsx          授权说明、余额、隐私与条款
src/i18n.js + locales.json   中英文文案与语言偏好
Dockerfile + compose.yml     单实例部署
docs/nginx.example.conf      反向代理模板（需替换域名与证书）
```

## 参考资料

- [Pollinations API 文档](https://github.com/pollinations/pollinations/blob/main/APIDOCS.md)
- [BYOP / 接入用户钱包](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md)
- [OAuth discovery](https://enter.pollinations.ai/.well-known/oauth-authorization-server)

## 素材与许可证

界面使用 React、Vite、Express 和 lucide-react。界面素材都存在本地，渲染工作台不依赖外部字体或图片 CDN。陶瓷场景是生成式灵感示例，不是当前 API 的真实返回。其余灵感摄影来自 Unsplash：

- https://images.unsplash.com/photo-1509316785289-025f5b846b35
- https://images.unsplash.com/photo-1600210492486-724fe5c67fb0
- https://images.unsplash.com/photo-1473116763249-2faaef81ccda

代码采用 **ISC** 许可证；第三方依赖和摄影素材保留各自的许可证或条款。Pollinations 名称仅用于准确署名，不代表拥有该品牌或获得官方背书。
