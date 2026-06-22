<div align="center">

# ⚡ Specularis v9 — Market Intelligence OS

**机构级美股情报终端 × 4大开源系统深度整合**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/specularis-v9)
![Version](https://img.shields.io/badge/version-9.0.0-brightgreen)
![Stack](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS%20%2B%20Vercel-black)

</div>

---

## 🆕 v9 全新整合：四大开源系统

| 系统 | 贡献能力 | 对应新功能 |
|------|---------|----------|
| **PanWatch（盯盘侠）** | Agent Loop 事件监控 + 持仓管理 | Tab 10 持仓追踪 + 顶部事件预警横幅 |
| **UZI-Skill（游资技能）** | 22维数据 × 量化规则 × 多流派陪审团 | Tab 9 情报OS + Tab 5 AI决策层升级 |
| **Horizon（新闻雷达）** | AI主题过滤 + 双语简报生成 | Tab 1 主题新闻雷达 + GitHub Actions 定时简报 |
| **daily_stock_analysis** | LLM决策仪表盘 + 多渠道推送 | /api/daily-briefing + Telegram 推送 |

---

## ✨ v9 新增功能（相比旧版）

### Tab 10 — 持仓追踪 & 异动预警（全新）
- 录入持仓（成本价、数量、方向）
- 止损/止盈线设置，触达时自动弹出预警
- 每 60 秒 Agent Loop 静默监控（PanWatch 架构）
- 数据存储在浏览器本地，无服务器

### 事件预警横幅（全新）
- RVOL > 2.0 异常放量自动触发
- 涨跌幅 ±3% 突破自动触发
- 持仓止损止盈线触达触发
- 顶部计数器显示累计事件数

### 主题新闻雷达（全新，Horizon 风格）
- 新闻自动分桶：AI/半导体 · 宏观/利率 · 云计算 · 加密 · 地缘
- 重要性评分（财报/升降级/宏观事件加权）
- Tab 1 盘前简报滚动条实时显示热点

### UZI 量化规则引擎（Tab 9 升级）
- 动能规则 · 风控规则 · 催化规则明确命中
- 看多/看空分数分离显示
- 触发风控规则时显示 BLOCK 标记

### GitHub Actions 定时简报（全新）
- 每日 07:30 / 14:00 / 21:00 ET 自动触发
- 支持 Telegram Bot 推送
- 零服务器成本

---

## 🚀 部署到 Vercel

```bash
git clone https://github.com/YOUR_USERNAME/specularis-v9
cd specularis-v9
# 推送到你的 GitHub 仓库，然后 Vercel 一键部署
```

---

## 🔑 环境变量

| 变量 | 用途 | 必须 |
|------|------|-----|
| `FINNHUB_API_KEY` | 实时行情（主数据源） | 推荐 |
| `TWELVEDATA_API_KEY` | 行情备用 | 可选 |
| `ALPHAVANTAGE_API_KEY` | 行情第三备用 | 可选 |
| `FRED_API_KEY` | 宏观数据 | 可选 |
| `ANTHROPIC_API_KEY` | LLM深度分析（未来版本） | 可选 |
| `TELEGRAM_BOT_TOKEN` | 定时简报推送 | Phase 2 |
| `TELEGRAM_CHAT_ID` | 推送目标 | Phase 2 |
| `VERCEL_URL` | GitHub Actions 回调地址 | Phase 2 |
| `UPSTASH_REDIS_REST_URL` | 持久缓存 | 可选 |
| `UPSTASH_REDIS_REST_TOKEN` | 持久缓存 | 可选 |

---

## 📁 v9 项目结构

```
specularis-v9/
├── index.html              # v9 主界面（10 Tab）
├── styles.css              # v9 设计系统 + 新增组件
├── app.js                  # 核心前端逻辑（含快照事件广播）
├── i18n.js                 # 中英双语
├── config.js               # v9 配置（SPECULARIS_V9_CONFIG）
├── manifest.json           # PWA 安装支持
├── vercel.json             # Vercel 部署配置
│
├── api/
│   ├── snapshot.js         # 主数据编排器（继承自 v7）
│   ├── daily-briefing.js   # 🆕 Horizon 每日简报生成
│   ├── event-monitor.js    # 🆕 PanWatch 事件检测
│   ├── congress-intel.js   # 国会持股情报
│   ├── stock-intel-enrichment.js
│   ├── daily-report.js
│   ├── trade-decision.js
│   └── health.js
│
├── modules/
│   ├── specularis-intelligence-os-v9.js  # 🆕 四系统整合 OS
│   ├── position-tracker.js               # 🆕 PanWatch 持仓追踪
│   ├── news-radar.js                     # 🆕 Horizon 新闻雷达
│   ├── event-monitor-ui.js               # 🆕 事件预警 UI
│   ├── specularis-terminal-lite.js       # 继承自 v7
│   ├── stock-intelligence-pro.js
│   ├── options-intelligence-lite.js
│   ├── congress-intel.js
│   ├── ai-decision-layer.js
│   └── ai-prompt-export.js
│
├── lib/                    # 后端共享库（继承自 v7）
│
├── .github/
│   └── workflows/
│       └── daily-briefing.yml  # 🆕 定时简报 GitHub Actions
│
└── scripts/
    └── dev-server.js
```

---

## 📋 Tab 功能一览

| Tab | 功能 | 说明 |
|-----|------|------|
| 01 | 盘前战情室 | Risk Regime + 主题新闻雷达（新） |
| 02 | 盘中信息流 | 实时新闻 + 动量雷达 |
| 03 | 个股情报 Pro | 深度卡片 × 10只核心标的 |
| 04 | 期权与波动率 | 代理 IV + Put/Call 信号 |
| 05 | 政要持股 · 情报 | STOCK Act + AI 决策层（UZI升级） |
| 06 | 收盘日报 | 日终复盘模板 |
| 07 | 明日计划 | 下日交易剧本 |
| 08 | AI Watchlist | 核心主题追踪 |
| 09 | 情报OS v9 | PanWatch × UZI × Horizon × DSA |
| **10** | **持仓追踪** | **🆕 PanWatch 持仓 + 预警** |

---

*MIT License · Specularis v9 · 研究教育用途*
