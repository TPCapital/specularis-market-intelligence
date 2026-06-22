<div align="center">

<img src="https://img.shields.io/badge/SPECULARIS-Market%20Intelligence-gold?style=for-the-badge&labelColor=0a0c14" alt="Specularis">

# Specularis Market Intelligence Terminal

**The Bloomberg Terminal you build yourself. Free. Open source. Deploys in 60 seconds.**

[**→ Live Demo**](https://specularis-market-intelligence.vercel.app) · [**Deploy Now**](#-deploy-in-60-seconds) · [**What's Inside**](#-whats-inside)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/TPCapital/specularis-market-intelligence)
![License MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Vercel](https://img.shields.io/badge/Vercel-Hobby%20compatible-black?style=flat-square&logo=vercel)
![No API key required](https://img.shields.io/badge/core%20data-no%20key%20required-brightgreen?style=flat-square)

</div>

---

## Why This Exists

Professional traders use $2,000/month terminals. Retail traders get a news feed and a moving average.

Specularis closes that gap. It pulls the same institutional data layers — macro regime, order flow signals, sector rotation, congress disclosures, Fed liquidity — and wraps them in a production-grade dashboard you own and control.

**No subscriptions. No paywalls. No ads. Fork it and it's yours.**

---

## ✨ What's Inside

### 🎯 Tab 01 — Pre-Market Intelligence Room
Everything you need before the open, assembled automatically:

| Module | What it shows | Data |
|---|---|---|
| **Risk Regime Engine** | Risk-On / Risk-Off / Neutral score (0–100) with VIX, breadth, trend synthesis | Live proxy |
| **Today's Strategy** | One-sentence bias with confidence level | Generated |
| **Market Index Grid** | SPY · QQQ · DIA · IWM · BTC · VIX with real-time change | Finnhub → Twelve Data → Stooq |
| **Market Structure Pro** | Sector rotation · Yield curve · Oil · Fed watch · Market breadth | Treasury.gov + DollarLiquidity |
| **Pre-Market Opportunity Scanner** | Ranked watchlist with momentum score, catalyst quality, options signal | Signal Engine |
| **Pre-Market Momentum Board** | Top 10 movers ranked by composite score with tags | Live quotes |
| **Hot Money Flow** | Sector heat ranking with AI tape-read | Finnhub |
| **Options Signal System** | CALL / PUT / WATCH proxy signals | Score model |
| **News Feed** | Bilingual (EN/CN) prioritized catalyst stream | Finnhub News |
| **Macro Wire** | Fed liquidity: TGA · Fed balance sheet · ONRRP · HY spread | DollarLiquidity.com (free) |
| **Retail Sentiment** | WSB heat gauge with watchlist mentions | Reddit JSON |

### 📊 Tab 02 — Intraday Live Flow Desk
Session-long momentum radar, live mover feed, and breaking news catalyst stream.

### 🔬 Tab 03 — Stock Intelligence Pro
Deep-dive cards for 10 core AI/semi names: NVDA · MRVL · MU · AVGO · AMD · TSM · ASML · PLTR · ORCL · SMCI. Each card shows price, trend, support/resistance, catalyst tags, earnings proximity, and AI narrative. Fully editable watchlist.

### ⚡ Tab 04 — Options Intelligence Lite
Proxy volatility structure and directional bias for each watchlist name. IV state · risk level · earnings warnings · reasoning. No real options feed required.

### 🏛️ Tab 05 — Congress Trading Intelligence *(Unique Feature)*
Automatically aggregates US Congressional stock disclosures (STOCK Act filings):
- **House + Senate trades** sorted by recency, watchlist tickers highlighted in gold
- **Activity rank** — which stocks congress members are most actively trading
- **Confluence signal** — tickers appearing in BOTH congressional disclosures AND social trending
- **StockTwits trending** + **Reddit hot posts** (r/wallstreetbets · r/stocks · r/investing)

> Zero API keys. All public data. Auto-refreshes every 15 minutes.

### 📋 Tab 06 — Daily Close Report
End-of-session review: index performance, top movers, sector rotation, what worked.

### 🗓️ Tab 07 — Next Session Playbook
Forward-looking plan: key levels, macro events, pre-open bias.

### 🧠 Tab 08 — AI Watchlist + Decision Layer
12 core AI/semiconductor/energy names scored across: Regime · Trend · Catalyst · Options · Social · Risk. Outputs a structured prompt for GPT-4 or Claude Pro.

---

## 💡 Dollar Liquidity Intelligence *(New in v7.2)*

Specularis now integrates **[DollarLiquidity.com](https://dollarliquidity.com)** — institutional-grade USD liquidity tracking, completely free:

| Indicator | What it means |
|---|---|
| **Net Liquidity** | Fed balance sheet minus TGA minus ONRRP — the real money supply driving markets |
| **TGA Balance** | Treasury cash pile at the Fed — drawdowns inject liquidity into markets |
| **ONRRP Usage** | Overnight reverse repo — when this falls, cash floods into risk assets |
| **HY Spread** | High yield credit spread — leading indicator of risk appetite |
| **SOFR-IORB** | Funding stress gauge — spikes signal plumbing pressure |
| **Liquidity Regime Score** | Composite P0–P100 — where we sit in the 5-year liquidity cycle |

These replace the FRED API dependency with zero-key public data.

---

## 🚀 Deploy in 60 Seconds

**One click:** [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/TPCapital/specularis-market-intelligence)

**Or manually:**
```bash
git clone https://github.com/TPCapital/specularis-market-intelligence
cd specularis-market-intelligence
# Push to GitHub → connect to Vercel → done
```

No build step. No bundler. No Docker. Pure HTML/CSS/JS with 7 Vercel serverless functions.

---

## 🔑 Optional API Keys

The terminal works out of the box with **zero API keys**. Add keys to unlock live data:

| Variable | Provider | Unlocks | Cost |
|---|---|---|---|
| `FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io) | Real-time quotes · news · earnings · insider trades | **Free tier** |
| `TWELVEDATA_API_KEY` | [twelvedata.com](https://twelvedata.com) | Quote fallback · technicals | **Free tier** |
| `ALPHAVANTAGE_API_KEY` | [alphavantage.co](https://alphavantage.co) | Tertiary quote fallback | Free |
| `UPSTASH_REDIS_REST_URL` + `TOKEN` | [upstash.com](https://upstash.com) | Persistent cache | **Free tier** |

**No keys needed for:** Treasury yields · Dollar Liquidity · Congress disclosures · StockTwits · Reddit signals

---

## 📡 Data Stack

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER                                                         │
│  index.html → app.js → modules/*.js (tabs 3–8)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ /api/snapshot (every 5 min)
┌──────────────────────────▼──────────────────────────────────────┐
│  VERCEL SERVERLESS  (7 functions, Hobby compatible)              │
│                                                                   │
│  /api/snapshot.js          Core data orchestrator                │
│  /api/congress-intel.js    Congress + Social proxy               │
│  /api/daily-report.js      Session close report                  │
│  /api/trade-decision.js    Trade plan generator                  │
│  /api/health.js            Data source status                    │
│  /api/stock-intel-enrichment.js   Per-stock deep-dive            │
│  /api/ai-prompt-generate.js       AI prompt builder              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  DATA SOURCES (free tier / no key)                               │
│                                                                   │
│  treasury.gov         Official US yield curve (2Y/10Y/30Y)       │
│  dollarliquidity.com  TGA · Fed BS · ONRRP · Net Liquidity       │
│  finnhub.io           Quotes · news · earnings (free tier)       │
│  stooq.com            Index quotes (no key)                      │
│  reddit.com/r/*.json  WSB · stocks · investing hot posts         │
│  api.stocktwits.com   Social trending symbols                    │
│  housestockwatcher.com  House STOCK Act filings                  │
│  senatestockwatcher.com Senate STOCK Act filings                 │
└─────────────────────────────────────────────────────────────────┘
```

### Graceful Degradation
Every data layer has a fallback chain. Nothing goes blank:
```
Treasury.gov LIVE → FRED (if key) → AlphaVantage (if key) → lastKnownGood cache
```

---

## 🌐 Bilingual (EN / CN)

Full interface in English and Chinese. Toggle in the top-right corner. News cards display both languages simultaneously. All module labels, section titles, and error states are translated.

---

## ⚠️ Data Integrity

- Auto-refreshes every **5 minutes**
- Every module shows real data state: `LIVE` · `DELAYED` · `PROXY` · `CACHED` · `UNAVAILABLE`
- Options signals are **proxy models** (price momentum + volume + sector + news) — not real institutional order flow
- Congress disclosures have **30–45 day filing delay** by law
- For research and educational purposes only. Not financial advice.

---

## 🛣️ Roadmap

- [ ] Real options flow (Polygon / Tradier integration)
- [ ] WebSocket streaming quotes
- [ ] Portfolio P&L tracker
- [ ] Telegram / Discord webhook alerts
- [ ] Mobile PWA (installable)
- [ ] Multi-market: HK · A-shares · LSE

---

## 🤝 Contributing

PRs welcome. Core principles:
1. **Data integrity first** — never label stale data as live
2. **CSS token system** — all colors/sizes through `:root` variables
3. **Zero build pipeline** — stays plain HTML/CSS/JS
4. **Graceful degradation** — every data source needs a fallback

---

## 📄 License

MIT — fork it, ship it, monetize it.

---

<div align="center">

**Built for traders who want institutional visibility without institutional pricing.**

⭐ Star this repo if it's useful to you.

[Live Demo](https://specularis-market-intelligence.vercel.app) · [Deploy Now](https://vercel.com/new/clone?repository-url=https://github.com/TPCapital/specularis-market-intelligence) · [Issues](https://github.com/TPCapital/specularis-market-intelligence/issues)

</div>

---

## 🔬 Open Source Intelligence Integration

Specularis v7.3 incorporates design principles and architectural patterns from 4 leading open-source market intelligence projects:

### 🏛 UZI-Skill — Multi-Perspective AI Scoring
*"51个投资大佬帮你看盘"* — Adapted for Specularis

UZI-Skill's 51-investor panel concept is condensed into **5 Analyst Lenses** in the AI Decision Layer:

| Lens | Focus | Inspired by |
|---|---|---|
| ⚡ 动能分析师 | Price momentum · RVOL · Pre-market strength | William O'Neil · Minervini |
| 🏛 价值猎手 | Support levels · Safety margin · No-chase rule | Buffett · Klarman · Graham |
| 🎯 事件驱动 | News catalysts · Earnings · Analyst consensus | Druckenmiller · Event-driven |
| 📊 期权流向 | IV structure · Put/Call · Options direction | Institutional options flow |
| 🌐 宏观环境 | Market regime · Sector rotation · Fed backdrop | Dalio · Macro regime |

Each lens scores 0–3 points independently. Final score = sum across lenses (max 100). Sorted by score descending.

### 📡 Horizon — News Intelligence Pipeline
*5.4k ⭐ AI-powered news radar*

Horizon's multi-source news pipeline principles applied to Specularis news feed:

- **Impact Scoring**: Each news item gets a 0–10 market impact score based on position, directional bias, ticker priority, and freshness
- **Urgency Badges**: 🔴 High Priority / 🟡 Watch / ⬜ Reference — first glance tells you what matters
- **Background Context**: Expandable per-item context panel for unfamiliar names/events
- **Deduplication**: Same story from multiple sources collapsed into one card

### 🎯 PanWatch + daily_stock_analysis — Three-Session Tactical Prompts
*盯盘侠 + 股票智能分析系统*

The AI Prompt Export module (Tab 08) now includes **three-session tactical prompts**:

| Session | Timing | Focus |
|---|---|---|
| 📈 盘前简报 | Pre-Market | Opening strategy · Top 3 setups · No-trade conditions |
| 🔴 盘中研判 | Intraday | Real-time trend check · Notable moves · Stop adjustments |
| 📋 盘后复盘 | Post-Market | Review · What worked · Tomorrow's bias |

Inspired by PanWatch's `盘前分析 / 盘中监测 / 盘后日报` architecture and daily_stock_analysis's three-phase strategy system (`进攻/均衡/防守`).

### 📈 daily_stock_analysis — Decision Dashboard Concept
*29.5k ⭐ · Multi-market LLM analysis*

The **Strategy Mode Banner** in the AI Decision Layer directly mirrors daily_stock_analysis's strategy output:

```
风险偏好开启（Risk-On）→ 进攻模式 → 积极参与动能标的
风险收缩（Risk-Off）   → 防守模式 → 规避高Beta标的
中性整理（Neutral）    → 均衡模式 → 轻仓等待方向
```

