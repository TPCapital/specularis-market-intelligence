# AI US Equity Flow Dashboard

一个纯前端、可直接部署的盘前美股信息流 Dashboard。页面打开后异步拉取可用数据源；任何接口失败、CORS 受限或超时都不会导致空屏，并会明确标注 LIVE、LAST 或 FALLBACK。

## 数据诚信规则

- 股票名单、异动榜、热钱板块、期权资金流、新闻与策略优先由 LIVE 数据生成。
- 页面每 3 分钟请求 `/api/snapshot?ts=Date.now()`，强制服务端实时生成统一 JSON。
- `/api/snapshot` 使用 `no-store` 响应头，避免 Vercel 或浏览器复用旧快照。
- `vercel.json` 配置了 Cron，在美股盘前时段自动请求 `/api/cron-refresh`；Hobby 计划不适合高频 Cron，所以页面打开时也会手动触发实时刷新。
- `/api/snapshot` 是“请求触发 + 进程内上次成功数据”的轻量方案；如果要做到交易级可靠，需要接入授权行情/API 并把快照写入 KV/数据库。
- 如果对应数据源没有实时返回，优先展示本机最后一次成功拉取的数据，并标注 `LAST` 与具体日期时间。
- 如果本机没有历史成功数据，展示内置备用快照，并标注 `FALLBACK · 备用快照 YYYY-MM-DD`。
- Fallback 可以用于避免空屏，但必须明确标注快照日期，不能标成实时。
- 要得到真实每日变化的期权流、新闻和热钱排行，需要接入对应授权 API 或可用代理。

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:4173
```

不要使用 `python3 -m http.server` 作为正式本地测试方式；它只能提供静态文件，不能运行 `/api/*` 数据代理，页面会一直显示 fallback。

## 公网部署

可直接部署到 Vercel。项目使用根目录静态文件 + `/api/*` Serverless Functions，不需要 `public` 目录。

- `index.html`
- `styles.css`
- `config.js`
- `app.js`
- `vercel.json`
- `package.json`
- `api/`
- `scripts/`

Vercel 设置建议：

- Framework Preset: `Other`
- Build Command: 留空，或使用 `vercel.json` 中的默认命令
- Output Directory: 留空，或由 `vercel.json` 的 `outputDirectory: "."` 接管
- Production Branch: `main`

如果 GitHub push 后没有自动部署，请检查 Vercel Project → Settings → Git：

- Connected Git Repository 是否正确
- Production Branch 是否是 `main`
- Auto Deployments 是否开启

## 数据源隔离

每个源只负责自己的模块：

- Yahoo Finance：指数、价格、盘前涨跌基础数据
- TradingView Screener：趋势筛选与明星股池
- Walter Bloomberg X / Kobeissi X：宏观快讯
- WallStreetBets Reddit：散户情绪
- Finviz Heatmap：热钱板块排行
- Unusual Whales：期权资金流
- Benzinga：盘前异动原因、利好/利空新闻分类

## 接口配置

编辑 `config.js` 的 `endpoints`。留空或接口失败时，对应模块进入 fallback 占位状态，不生成实时排名。

```js
window.DASHBOARD_CONFIG = {
  refreshSeconds: 180,
  endpoints: {
    xMacro: "/api/x-macro",
    finvizHeatmap: "/api/finviz-heatmap",
    unusualWhales: "/api/unusual-whales",
    benzinga: "/api/benzinga",
    tradingViewScreener: "/api/tradingview-screener"
  }
};
```

## 推荐 JSON 契约

`xMacro`

```json
[
  { "source": "Walter Bloomberg", "title": "...", "summary": "...", "tone": "bullish" }
]
```

`finvizHeatmap`

```json
[
  { "sector": "AI 半导体", "score": 92, "change": 1.8, "summary": "..." }
]
```

`unusualWhales`

```json
[
  { "symbol": "NVDA", "type": "Call Sweep", "premium": 2.8, "summary": "..." }
]
```

`benzinga`

```json
{
  "movers": [
    { "symbol": "NVDA", "change": 2.4, "reason": "...", "bias": "利好" }
  ],
  "news": [
    { "category": "AI", "title": "...", "summary": "...", "bias": "利好", "time": "07:28" }
  ]
}
```

`tradingViewScreener`

```json
[
  { "symbol": "NVDA", "score": 86, "logic": "趋势强度领先。" }
]
```
