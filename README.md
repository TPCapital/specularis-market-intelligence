# AI US Equity Flow Dashboard

一个纯 HTML / CSS / Vanilla JS + Vercel Serverless 的机构风格美股信息流交易终端。页面打开后主动请求 `/api/snapshot?ts=Date.now()`，并把行情、新闻、风险偏好、热点板块、盘前异动与 Options Flow Proxy 统一成可视化交易面板。

## 数据诚信规则

- 前端每 60 秒刷新一次；服务端快照与 Cron 按 `vercel.json` 配置执行。
- 页面打开时始终主动请求 `/api/snapshot?ts=Date.now()`，不会只依赖 Vercel Cron。
- `/api/snapshot` 使用 `no-store` 响应头，避免 Vercel 或浏览器复用旧快照。
- Vercel Hobby 计划可能不保证高频 Cron 执行；Cron 只用于辅助预热，实时刷新以页面请求 `/api/snapshot` 为主。
- Yahoo / Reddit / TradingView 可显示 `LIVE` 或 `DELAYED`；Finviz、Benzinga、X Macro、Unusual Whales 在未接入真实授权 API 前统一显示 `PROXY` 或 `SNAPSHOT`。
- 如果多源行情失败，SPY、QQQ、NDX、VIX、TNX、DXY、GOLD 使用最近结构快照，不显示 0，不显示 Yahoo waiting。
- 盘前异动榜优先使用新闻/异动源；如果 movers 为空，自动从 Yahoo quotes 按涨跌幅绝对值生成；quotes 也为空时使用 snapshot movers。
- Options Flow Proxy 不是真实机构期权大单流，只是基于价格动量、相对成交量、板块热度、新闻情绪、相对强弱、盘前涨跌和散户关注生成的代理信号。
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

## Vercel Cron

`vercel.json` 配置：

- 美股盘前与盘中窗口：UTC `8-21` 点，每 15 分钟辅助刷新。
- 其它时间：每 6 小时低频刷新。

Hobby 计划可能限制 Cron 频率或不保证准点执行，因此页面打开时仍会主动刷新 `/api/snapshot`。

## 数据源隔离

每个源只负责自己的模块：

- Yahoo Finance / Stooq / AlphaVantage demo：指数、价格、盘前涨跌基础数据
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
    yahoo: "/api/yahoo",
    reddit: "/api/reddit",
    xMacro: "/api/x-macro",
    finvizHeatmap: "/api/finviz-heatmap",
    unusualWhales: "/api/unusual-whales",
    benzinga: "/api/benzinga",
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
    "yahoo": { "status": "live", "data": { "indices": [], "quotes": [] } },
    "benzinga": { "status": "proxy", "data": { "movers": [], "news": [] } },
    "unusualWhales": { "status": "proxy", "data": [] }
  }
}
```

`benzinga.data.movers` 若为空，前端会自动从 `yahoo.data.quotes` 派生，不让盘前异动榜空白。
