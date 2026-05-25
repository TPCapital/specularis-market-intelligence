# AI US Equity Flow Dashboard

一个纯 HTML / CSS / Vanilla JS + Vercel Serverless 的机构风格美股信息流交易终端。页面打开后主动请求 `/api/snapshot?ts=Date.now()`，并把核心行情、新闻、风险偏好、热点板块、盘前异动与 Options Flow Proxy 统一成可视化交易面板。

## 数据诚信规则

- 前端每 5 分钟刷新一次，并在页面打开时主动请求 `/api/snapshot?ts=Date.now()`。
- `vercel.json` 当前不配置定时任务，适配 Vercel Hobby 免费版；刷新主要由页面请求触发。
- `/api/snapshot` 使用 `no-store` 响应头，避免 Vercel 或浏览器复用旧快照。
- Dashboard 统一区分 `LIVE`、`DELAYED`、`SNAPSHOT`、`STALE`、`UNAVAILABLE`。每个模块都会显示数据状态与最后真实更新时间，页面刷新时间不等于数据更新时间。
- 核心行情层只有 `sources.marketData`。`sources.finnhub` 只作为 Finnhub 健康检查与真实行情探针保留。
- `STALE` / fallback 只来自最近一次成功缓存，用于避免页面完全空白；不得伪装成 LIVE。
- Options Flow Proxy 不是真实机构期权大单流，只是基于价格动量、相对成交量、板块热度、新闻情绪、相对强弱、盘前涨跌和散户关注生成的代理信号。
- 要得到真实每日变化的期权流、新闻和热钱排行，需要接入对应授权 API 或可用代理。

## 分层架构

- Layer 1 实时行情层：`sources.marketData`
- Layer 2 市场结构层：Advance/Decline、Breadth、Sector Rotation、Index Confirmation
- Layer 3 机构行为层：Finnhub Insider / Earnings（无 key 自动降级）
- Layer 4 新闻催化层：Benzinga API、Finnhub company/market news、Reuters RSS、MarketWatch RSS、SEC Filing Feed
- Layer 5 交易信号层：Premarket Scanner + Signal Engine

新增数据层模块（均在 `lib/`）：

- `earnings.js`：Earnings Layer，整合 Finnhub/AlphaVantage 财报日历
- `insider.js`：Insider Layer，整合 Finnhub 内部人交易信号
- `relative-volume.js`：Relative Volume Scanner，生成 RVOL 扩张与代理量能信号
- `market-breadth.js`：Market Breadth Engine，输出 breadth score 与 regime hint

## 核心行情架构

`/api/snapshot` 返回唯一核心行情层：

```js
sources.marketData = {
  provider,
  status,
  confidence,
  fallback,
  indices,
  quotes,
  data: { provider, indices, quotes }
};
```

行情聚合优先级：

- Finnhub
- TwelveData
- TradingView
- AlphaVantage
- Stooq
- cached snapshot

若 Finnhub 成功，`marketData.provider = "Finnhub"`，`status = "live"`，`fallback = false`。
若 TwelveData 成功，`marketData.provider = "TwelveData"`，`status = "delayed"`。
最终兜底只允许使用最近一次成功缓存，并标记为 `CACHED` 或 `STALE`；超过 6 小时标记 `STALE`，完全没有缓存才标记 `ERROR`。

## 当前免费版数据限制

- 推荐在 Vercel Environment Variables 添加 `FINNHUB_API_KEY` 与 `TWELVEDATA_API_KEY`。不添加也能运行，但 Finnhub / TwelveData 会显示 `UNAVAILABLE`，系统会降级到 Stooq / AlphaVantage / cached snapshot。
- 建议补充 `ALPHAVANTAGE_API_KEY`、`FRED_API_KEY` 用于宏观层和结构层。
- `TRADIER_TOKEN` 可预留给未来真实期权数据；当前版本不会使用它，也不会因为未配置而报错。
- 没有真实 Unusual Whales / Cheddar Flow / Polygon Options 级别的期权大单流。
- 没有真实 Benzinga 授权新闻 API 时，新闻层会降级到 Finnhub / Reuters / MarketWatch / SEC；若仍无新闻，返回 `no_realtime_news`。
- 没有 WebSocket 实时行情，免费源可能延迟、限流或间歇失败。
- lastKnownGood 缓存用于避免页面空白和保留结构参考；系统会显示“最新快照 / 缓存快照 / 延迟数据 / 暂无可用源”，并降级为低置信度，不应视作真实实时交易确认。
- 只有 API 完全不可用且没有任何最近一次有效缓存时，系统才显示 `ERROR / 暂无可用源`。

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:4173
```

不要使用 `python3 -m http.server` 作为正式本地测试方式；它只能提供静态文件，不能运行 `/api/snapshot` 数据代理。

## 公网部署

可直接部署到 Vercel。当前 Vercel Hobby 兼容架构为：

- `/api/snapshot` 是唯一公开 Serverless Function
- `lib/` 为内部数据源聚合模块
- 前端只请求 `/api/snapshot`

项目结构：

- `index.html`
- `styles.css`
- `config.js`
- `app.js`
- `vercel.json`
- `package.json`
- `api/`（仅 `snapshot.js`）
- `lib/`
- `scripts/`

Vercel 设置建议：

- Framework Preset: `Other`
- Build Command: 留空，或使用 `vercel.json` 中的默认命令
- Output Directory: 留空，或由 `vercel.json` 的 `outputDirectory: "."` 接管
- Production Branch: `main`

## 数据源隔离

每个源只负责自己的模块：

- `marketData`：核心指数、价格、盘前涨跌基础数据
- Finnhub：优先股票行情、公司新闻、财报与内部人数据
- TwelveData：补充 ETF、指数、外汇与商品行情
- TradingView Screener：趋势筛选与明星股池
- AlphaVantage / Stooq：行情与宏观备用适配层
- FRED：宏观利率、通胀与就业结构
- WallStreetBets Reddit：散户情绪
- Sector Heat Proxy：热点板块排行
- Options Flow Proxy：期权方向代理评分，不是真实期权大单流
- News Catalyst：盘前异动原因、新闻分类与中文重写

## 接口配置

编辑 `config.js`：

```js
window.DASHBOARD_CONFIG = {
  refreshSeconds: 300,
  endpoints: {
    snapshot: "/api/snapshot"
  }
};
```

## 推荐 JSON 契约

`/api/snapshot` 返回统一结构：

```json
{
  "generatedAt": 1778935162481,
  "sources": {
    "marketData": {
      "provider": "Finnhub",
      "status": "live",
      "confidence": "HIGH",
      "fallback": false,
      "indices": [],
      "quotes": [],
      "data": { "provider": "Finnhub", "indices": [], "quotes": [] }
    },
    "finnhub": { "status": "LIVE", "testSymbols": ["AAPL", "NVDA", "SPY", "QQQ"], "quotes": [] },
    "twelveData": { "status": "delayed", "data": [] },
    "benzinga": { "status": "unavailable", "data": { "movers": [], "news": [] } }
  }
}
```

`benzinga.data.movers` 若为空，前端会从 `marketData.quotes` 派生盘前异动榜；如果核心行情也为空，则显示空状态，不生成伪信号。
