<div align="center">

# ⚡ Specularis Market Intelligence Terminal

**Institutional-grade US equity intelligence platform, deployable in minutes.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/specularis-market-intelligence)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-7.0-brightgreen)
![Stack](https://img.shields.io/badge/stack-HTML%20%2F%20CSS%20%2F%20JS%20%2B%20Vercel-black)

[Live Demo](#) · [Deployment Guide](#-one-click-deploy) · [API Configuration](#-api-configuration) · [Architecture](#-architecture)

</div>

---

## What is Specularis?

Specularis is a self-hosted market intelligence terminal that aggregates real-time US equity data into a single, professional-grade dashboard — the kind of view institutional traders use, without the Bloomberg terminal price tag.

It runs entirely on static HTML + CSS + Vanilla JavaScript with a lightweight Vercel serverless backend. Zero frameworks, zero build pipeline friction. Fork, configure your API keys, and deploy in under 5 minutes.

---

## ✨ Feature Overview

### 🖥️ Pre-Market Intelligence Room
The core workspace. Everything you need before the US market opens:

- **Risk Regime Dashboard** — Live risk score with VIX, 10Y yield, DXY, and CNN Fear/Greed synthesis
- **Today's Strategy** — AI-generated single-sentence trading bias based on macro state
- **Market Index Grid** — SPY, QQQ, DIA, IWM, BTC, VIX with live change and contextual color coding
- **Market Structure Pro** — Sector rotation, yield curve, oil, Fed posture, and market breadth in a 5-card Bloomberg-style panel
- **Pre-Market Opportunity Scanner** — Ranked opportunities scored across momentum, catalyst quality, sector heat, and option proxies
- **Pre-Market Momentum Board** — Top movers with rank, score, signal tags, and contextual descriptions
- **Pre-Market Trade Plan** — Concrete watchlist with setups, levels, and entries for the session ahead
- **Hot Money Flow** — Real-time sector heat ranking with AI tape-read interpretation
- **Options Signal System** — CALL / PUT / WATCH / AVOID proxy signals generated from price momentum, relative volume, sector strength, and news sentiment
- **Bullish / Bearish News Feed** — Prioritized, bilingual (CN/EN) news cards with urgency ranking
- **Macro Wire** — FRED macro data, Fed signals, yield indicators
- **Retail Sentiment / WSB Heat** — Reddit mention momentum and sentiment gauge
- **Data Source Status** — Full transparency on every data provider: LIVE / DELAYED / CACHED / UNAVAILABLE

### 📊 Intraday Live Flow Desk
Session-long intelligence feed with momentum radar and breaking news catalyst stream.

### 📈 Stock Intelligence Pro (Tab 3)
Deep-dive cards for 10 core semiconductor + AI names (NVDA, MRVL, MU, AVGO, AMD, TSM, ASML, PLTR, ORCL, SMCI). Each card shows price, change, sector, key support/resistance levels, earnings proximity, catalyst tags, and AI summary. Fully editable — add your own watchlist names.

### ⚡ Options Intelligence Lite (Tab 4)
Proxy volatility and options structure signals for each watchlist name. Shows IV structure (bullish/bearish/neutral), risk level, earnings warnings, and reasoning. Designed for traders who want directional context without a full options feed subscription.

### 🏛️ Congress Intel + AI Decision Layer (Tab 5)
**全自动信息抓取，零手动输入。** 取代原 KOL 手动蒸馏模块，改为自动聚合三类公开免费数据源：

**国会持股情报（STOCK Act 申报）**
- 众议院交易数据：`housestockwatcher.com/api` — 社区整理的 House 持股申报 JSON，免费无需密钥
- 参议院交易数据：`senatestockwatcher.com/api` — 同上，Senate 版本
- 国会活跃榜：按股票代码汇总近90天买入/卖出次数，标注涉及议员人数
- 观察池优先排序：NVDA / AMD / PLTR 等核心标的优先显示并高亮标注

**社交情绪（StockTwits）**
- `api.stocktwits.com/api/2/trending/symbols.json` — 实时热搜榜，含情绪比例（看多/看空%）
- 观察池7只核心标的逐一拉取情绪流，展示最新3条帖子预览
- 零 API 密钥，公开 JSON 端点直接调用

**Reddit 社区信号**
- `r/wallstreetbets`、`r/stocks`、`r/investing` 热帖 JSON 流（Reddit 官方免费端点）
- 自动提取帖子中的股票代码，生成标的热度频率榜
- 显示评分 > 10 的热帖，标注观察池相关标的

**共振信号（Confluence）**
国会持股变动 × 社交媒体热搜 同时出现的标的，触发 "⚡ 共振" 高亮警报——这是最值得关注的交叉信号。

AI Decision Layer 保留不变，综合评分维度更新为：市场环境 + 股价动能 + 催化质量 + 期权 + 社交共振 + 风控。

### 📋 Daily Close Report (Tab 6)
End-of-day review template: index performance, top movers, sector rotation, what worked, what didn't.

### 🗓️ Next Session Playbook (Tab 7)
Forward-looking session plan built from current data: key levels, macro events, positions to watch, and pre-open bias.

### 📌 AI Watchlist (Tab 8)
Persistent tracking of 12 core AI/semiconductor/energy names across themes: AI Infrastructure, Semiconductors, Software, Power, Nuclear.

---

## 🚀 One-Click Deploy

Deploy to Vercel in one click — no local setup required:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/specularis-market-intelligence)

Or deploy manually:

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/specularis-market-intelligence
cd specularis-market-intelligence

# Install (only needed for local dev server)
npm install

# Run local dev
npm run dev
# → http://127.0.0.1:4173
```

> **Important:** Do not use `python3 -m http.server` for local dev. It serves static files only and cannot run the `/api/snapshot` data proxy that powers the terminal.

---

## 🔑 API Configuration

Specularis works out of the box with no API keys — it falls back to cached data and proxy signals. To unlock live data, add these environment variables in Vercel → Project Settings → Environment Variables:

| Variable | Provider | What it unlocks | Tier |
|---|---|---|---|
| `FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io) | Real-time quotes, news, insider trades, earnings | **Free tier available** |
| `TWELVEDATA_API_KEY` | [twelvedata.com](https://twelvedata.com) | Quote fallback, technical indicators | **Free tier available** |
| `ALPHAVANTAGE_API_KEY` | [alphavantage.co](https://alphavantage.co) | Quote tertiary fallback | Free |
| `FRED_API_KEY` | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) | Macro data: yield curve, CPI, PCE | Free |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | [upstash.com](https://upstash.com) | Persistent snapshot cache across deployments | Free tier available |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | [supabase.com](https://supabase.com) | Persistent cache alternative (Postgres) | Free tier available |

> **Tab 5 (Congress Intel) 完全无需 API 密钥。** 以下数据源均为免费公开端点，直接调用：
> - `housestockwatcher.com/api` — 众议院 STOCK Act 申报
> - `senatestockwatcher.com/api` — 参议院 STOCK Act 申报  
> - `api.stocktwits.com/api/2/*` — StockTwits 公开 JSON API
> - `reddit.com/r/*.json` — Reddit 官方公开 JSON 端点

None of these are required for the terminal to function. The system degrades gracefully:

```
Finnhub LIVE → TwelveData DELAYED → AlphaVantage → Stooq → lastKnownGood CACHE → STALE
```

Every module shows its actual data state (LIVE / DELAYED / PROXY / CACHED / STALE / UNAVAILABLE) so you always know what you're looking at.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND                          │
│  index.html → styles.css → app.js → i18n.js        │
│  modules/specularis-terminal-lite.js                │
│  (Stock Intel Pro · Options Lite · KOL · AI Layer) │
└─────────────────────┬───────────────────────────────┘
                      │ fetch /api/snapshot
┌─────────────────────▼───────────────────────────────┐
│                 VERCEL SERVERLESS                    │
│  /api/snapshot.js  — Orchestrator                   │
│                                                     │
│  lib/                                               │
│  ├── market-structure-pro.js   Sector/Yield/Breadth │
│  ├── signal-engine.js          Pre-market signals   │
│  ├── trade-decision-engine.js  Trade plan generator │
│  ├── narrative-engine.js       Daily report engine  │
│  ├── stock-intel-enricher.js   Per-stock deep-dive  │
│  ├── earnings.js               Earnings calendar    │
│  ├── insider.js                Insider transactions │
│  ├── relative-volume.js        RVOL scanner         │
│  ├── market-breadth.js         Breadth + regime     │
│  ├── finnhub.js / twelvedata.js / alphavantage.js   │
│  └── provider-utils.js         Fallback orchestrator│
└─────────────────────────────────────────────────────┘
```

### Data Layers

| Layer | Role | Providers |
|---|---|---|
| **Layer 1** — Real-time Quotes | Index + stock prices | Finnhub → TwelveData → AlphaVantage → Stooq |
| **Layer 2** — Market Structure | Sectors, breadth, yields, Fed | FRED + Finnhub + proxy models |
| **Layer 3** — Institutional Behavior | Insider trades, earnings calendar | Finnhub (auto-degrades without key) |
| **Layer 4** — News Catalyst | Breaking news, macro wire | Finnhub News → Reuters RSS → MarketWatch RSS → SEC |
| **Layer 5** — Trading Signals | Pre-market scanner, opportunity ranker | Signal Engine (proxy model, no paid feed required) |

---

## 🌐 Internationalization

The terminal ships bilingual (Chinese / English). Press the `EN` toggle in the top-right corner of the interface to switch languages. News titles display in both languages simultaneously (CN primary, EN secondary). All module labels and section headers respect the language state.

To extend: edit `i18n.js` — it's a flat key-value map with `cn` and `en` namespaces.

---

## ⚠️ Data Integrity Rules

Specularis is designed for educational and research purposes. Real-money trading decisions require additional verification.

- The terminal auto-refreshes every **5 minutes** via page-triggered requests to `/api/snapshot`.
- Every module displays its real data state — `LIVE`, `DELAYED`, `SNAPSHOT`, `STALE`, or `UNAVAILABLE`. Page refresh time ≠ data update time.
- **Options signals are proxies**, not real institutional order flow. They are generated from price momentum, RVOL, sector heat, QQQ/SPY direction, and news sentiment — not from real options tape data (Unusual Whales / Cheddar Flow level).
- `STALE` / fallback data comes from the most recent successful cache to prevent blank pages. It is never presented as live.
- When `UPSTASH` or `SUPABASE` are not configured, the cache adapter falls back to in-memory (resets on cold start).

---

## 🛣️ Roadmap

| Feature | Status |
|---|---|
| Real options flow integration (Polygon / Tradier) | 🔜 Planned |
| WebSocket real-time quote streaming | 🔜 Planned |
| Portfolio P&L tracker | 🔜 Planned |
| Telegram / Slack alert webhooks | 🔜 Planned |
| Backtesting signal engine | 🔜 Planned |
| Mobile PWA (installable) | 🔜 Planned |
| Multi-market support (HK, A-shares, LSE) | 🔜 Planned |

---

## 📁 Project Structure

```
specularis-market-intelligence/
├── index.html              # Main HTML shell
├── styles.css              # Unified design system (v7.0)
├── app.js                  # Core frontend logic
├── i18n.js                 # Bilingual string map
├── config.js               # Client-side config
├── vercel.json             # Vercel deployment config
├── package.json
│
├── api/
│   ├── snapshot.js         # Main data orchestrator (Vercel serverless)
│   ├── finnhub.js
│   ├── alphavantage.js
│   ├── twelvedata.js
│   ├── fred.js
│   ├── daily-report.js
│   └── trade-decision.js
│
├── lib/
│   ├── market-structure-pro.js
│   ├── signal-engine.js
│   ├── trade-decision-engine.js
│   ├── narrative-engine.js
│   ├── stock-intel-enricher.js
│   ├── earnings.js
│   ├── insider.js
│   ├── relative-volume.js
│   ├── market-breadth.js
│   ├── market-regime.js
│   ├── auto-intel.js
│   ├── premarket-scanner.js
│   ├── watchlist-engine.js
│   ├── provider-utils.js
│   └── market-terminal/
│       ├── promptBuilder.js
│       ├── scoring.js
│       ├── schema.js
│       └── fallbackData.js
│
└── modules/
    ├── specularis-terminal-lite.js   # Tabs 3–5 controller
    ├── stock-intelligence-pro.js
    ├── options-intelligence-lite.js
    ├── kol-distillation.js
    ├── ai-decision-layer.js
    └── ai-prompt-export.js
```

---

## 🤝 Contributing

Pull requests welcome. Before submitting:

1. Preserve the data integrity rules — never label stale data as live
2. New UI components should use the CSS custom property system in `:root`
3. New data providers should implement the `{ status, provider, fallback }` interface used by existing sources
4. Keep the zero-build-pipeline constraint — this ships as plain HTML/CSS/JS

---

## 📄 License

MIT License. See `LICENSE` for details.

---

<div align="center">

Built for traders who want professional-grade market visibility without the institutional price tag.

**Star ⭐ this repo if it's useful.**

</div>
