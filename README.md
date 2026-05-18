# AI US Equity Flow Dashboard

一个纯 HTML / CSS / Vanilla JS + Vercel Serverless 的机构风格美股信息流交易终端。页面打开后主动请求 `/api/snapshot?ts=Date.now()`，并把行情、新闻、风险偏好、热点板块、盘前异动与 Options Flow Proxy 统一成可视化交易面板。

## 数据诚信规则

- 前端每 60 秒刷新一次，并在页面打开时主动请求 `/api/snapshot?ts=Date.now()`。
- `vercel.json` 当前不配置定时任务，适配 Vercel Hobby 免费版；刷新主要由页面请求触发。
- `/api/snapshot` 使用 `no-store` 响应头，避免 Vercel 或浏览器复用旧快照。
- Dashboard 统一区分 `LIVE`、`DELAYED`、`PROXY`、`CACHED`、`SNAPSHOT`、`UNAVAILABLE`。每个模块都会显示数据状态与最后真实更新时间，页面刷新时间不等于数据更新时间。
- `SNAPSHOT` / fallback 用于防止页面空白，并以低置信度代理输入参与方向辅助；页面会明确标记其可信度，不能视作机构级实时信号。
- `CACHED` 数据超过 15 分钟后不参与交易评分。
- Finnhub / TwelveData / Yahoo / Reddit / TradingView 可显示 `LIVE` 或 `DELAYED`；Finviz、Benzinga、X Macro、Unusual Whales 在未接入真实授权 API 前统一显示 `PROXY` 或 `SNAPSHOT`。
- 如果多源行情失败，SPY、QQQ、NDX、VIX、TNX、DXY、GOLD 使用最近结构快照，不显示 0，不显示 Yahoo waiting。
- 盘前异动榜优先使用新闻/异动源；如果 movers 为空，自动从 Yahoo quotes 按涨跌幅绝对值生成；quotes 也为空时使用 snapshot movers。
- Options Flow Proxy 不是真实机构期权大单流，只是基于价格动量、相对成交量、板块热度、新闻情绪、相对强弱、盘前涨跌和散户关注生成的代理信号。
- 要得到真实每日变化的期权流、新闻和热钱排行，需要接入对应授权 API 或可用代理。

## 分层架构

- Layer 1 实时行情层：Finnhub + TradingView + AlphaVantage + TwelveData + Stooq + Snapshot fallback
- Layer 2 市场结构层：Advance/Decline、Breadth、Sector Rotation、Index Confirmation
- Layer 3 机构行为层：Finnhub Insider / Earnings（无 key 自动降级）
- Layer 4 新闻催化层：Benzinga -> Finnhub company/market news -> Yahoo RSS -> Snapshot
- Layer 5 交易信号层：Premarket Scanner + Signal Engine

## 行情优先级

- 指数：`TwelveData -> Finnhub -> TradingView -> AlphaVantage -> Stooq -> Yahoo -> Snapshot`
- 个股：`Finnhub -> TwelveData -> TradingView -> AlphaVantage -> Stooq -> Yahoo -> Snapshot`
- 新闻：`Benzinga -> Finnhub company/market news -> Yahoo RSS -> Snapshot`

## 当前免费版数据限制

- 推荐在 Vercel Environment Variables 添加 `FINNHUB_API_KEY` 与 `TWELVEDATA_API_KEY`。不添加也能运行，但 Finnhub / TwelveData 会显示 `UNAVAILABLE`，系统会降级到 Yahoo / Stooq / proxy / snapshot。
- 建议补充 `ALPHAVANTAGE_API_KEY`、`FRED_API_KEY` 用于宏观层和结构层。
- `TRADIER_TOKEN` 可预留给未来真实期权数据；当前版本不会使用它，也不会因为未配置而报错。
- 没有真实 Unusual Whales / Cheddar Flow / Polygon Options 级别的期权大单流。
- 没有真实 Benzinga 授权新闻 API，Yahoo RSS 与新闻代理可能延迟。
- 没有 WebSocket 实时行情，Yahoo / TradingView / Reddit 可能延迟、限流或间歇失败。
- TradingView / Yahoo / Stooq / AlphaVantage demo 是免费行情适配层，不保证逐笔实时。
- Snapshot 用于避免页面空白和保留结构参考；系统会降级为低置信度 proxy inference，不应视作真实实时交易确认。
- 只有 API 完全不可用且行情为空时，系统才显示“数据不足”。

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:4173
```

不要使用 `python3 -m http.server` 作为正式本地测试方式；它只能提供静态文件，不能运行 `/api/*` 数据代理。

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

## 数据源隔离

每个源只负责自己的模块：

- Yahoo Finance / Stooq / AlphaVantage demo：指数、价格、盘前涨跌基础数据
- Finnhub：优先股票行情、公司新闻与市场新闻
- TwelveData：补充 ETF、指数、外汇与商品行情
- TradingView Screener：趋势筛选与明星股池
- Macro Proxy：宏观快讯
- WallStreetBets Reddit：散户情绪
- Sector Heat Proxy：热点板块排行
- Options Flow Proxy：期权方向代理评分，不是真实期权大单流
- News Catalyst Proxy：盘前异动原因、新闻分类与中文重写

## 接口配置

编辑 `config.js`：

```js
window.DASHBOARD_CONFIG = {
  refreshSeconds: 60,
  endpoints: {
    snapshot: "/api/snapshot",
    finnhub: "/api/finnhub",
    twelvedata: "/api/twelvedata",
    alphavantage: "/api/alphavantage",
    fred: "/api/fred",
    reddit: "/api/reddit",
    finvizHeatmap: "/api/finviz-heatmap",
    tradingViewScreener: "/api/tradingview-screener"
  }
};
```

## 推荐 JSON 契约

`/api/snapshot` 返回统一结构：

```json
{
  "generatedAt": 1778935162481,
  "sources": {
    "finnhub": { "status": "live", "data": [] },
    "twelveData": { "status": "delayed", "data": [] },
    "yahoo": { "status": "live", "data": { "indices": [], "quotes": [] } },
    "benzinga": { "status": "proxy", "data": { "movers": [], "news": [] } },
    "unusualWhales": { "status": "proxy", "data": [] }
  }
}
```

`benzinga.data.movers` 若为空，前端会自动从 `yahoo.data.quotes` 派生，不让盘前异动榜空白。  
`Yahoo/Benzinga/UnusualWhales/X Macro` 当前为 `/api/snapshot` 内部聚合代理，不再单独暴露 `/api/*` 端点（兼容 Vercel Hobby 8 个函数上限）。
