# AI 美股信息流交易系统 v4.0

**AI US Equity Flow Terminal** — 多源市场情报系统，包含政治内部人士追踪、SWR 分层缓存架构与叙事引擎。

---

## v4.0 新功能

### 1. 政治内部人士交易层 (`api/trump-trades.js`)
- **数据源**：QuiverQuant Congressional Trading API（免费端点）
- **架构**：Push-based Cron（每小时写入 Redis）+ SWR 前端消费
- **TTL**：15 分钟（符合数据分层时效矩阵中频/叙事层）
- **信号标准化**：Ticker、买卖方向、金额区间、披露日期、signalWeight
- **自动叙事生成**：知情买入 × 热门板块 → 自动输出投研逻辑

### 2. 叙事引擎 v2 (`lib/narrative-engine.js`)
- **政策共振检测**：政治交易 × 板块流量 → 识别叠加信号
- **结构化叙事输出**：市场状态 / 政策共振 / 动能确认 / 执行纪律 四层叙事
- **置信度提升机制**：resonanceItems → boostedTickers → Signal Engine 放大

### 3. SWR 分层缓存架构
| 数据类型 | TTL | 刷新策略 |
|---------|-----|---------|
| 实时价格（Finnhub） | 10-30s | 客户端触发 + 缓存穿透保护 |
| 市场宽度 / 政治交易 / 社交情绪 | 5-15min | SWR 后台异步静默刷新 |
| FRED 宏观 / 政策深度分析 | 12-24h | Cron Job 主动推入 |

### 4. Signal Engine v2 (`lib/signal-engine.js`)
- **政治因子**：polBuyCount × 信号权重 → riskAppetite 最大 +8pts 提升
- **叙事共振因子**：resonanceItems → 每个共振标的 +1.5pts
- **per-ticker 置信度标记**：politicalBoost 字段

### 5. Vercel Cron 配置
```json
{
  "crons": [
    { "path": "/api/trump-trades", "schedule": "0 * * * *" },
    { "path": "/api/snapshot", "schedule": "*/5 * * * *" }
  ]
}
```

---

## 快速开始

### 环境变量（Vercel / `.env.local`）
```
FINNHUB_API_KEY=your_key
TWELVEDATA_API_KEY=your_key
ALPHAVANTAGE_API_KEY=your_key
FRED_API_KEY=your_key

# 持久缓存（推荐 Upstash Redis，免费层即可）
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# 可选：Supabase 作为缓存替代
# SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

### 本地开发
```bash
npm run dev
```

### 部署
```bash
vercel --prod
```

---

## 架构说明

### BFF 缓存模式（Stale-While-Revalidate）
```
前端请求 → /api/snapshot
           ↓
      Redis 缓存层
      ├── 有效（TTL 内）→ 立即返回给前端
      └── 过期 → 立即返回旧数据 + 后台异步刷新 Finnhub / Fred / QuiverQuant
```

### 政治交易 Push 模式
```
Cron（每小时）→ /api/trump-trades
                 ↓
           QuiverQuant 爬取
                 ↓
           标准化 → Redis.set('narrative:trump_trades', data, TTL=900)
                 ↓
前端 /api/snapshot 读取 Redis Key，无需实时爬取
```

---

## 文件结构

```
├── api/
│   ├── snapshot.js          # 主快照 API（v4：集成政治交易 + 叙事引擎）
│   └── trump-trades.js      # 政治内部人士交易层（新增）
├── lib/
│   ├── narrative-engine.js  # 叙事引擎 v2（新增）
│   ├── signal-engine.js     # 信号引擎 v2（含政治因子）
│   ├── market-regime.js     # 市场状态感知
│   ├── market-breadth.js    # 市场宽度引擎
│   ├── relative-volume.js   # 相对成交量扫描
│   ├── confidence-score.js  # 置信度评分
│   ├── strategy-engine.js   # 策略摘要生成
│   ├── trade-plan.js        # 交易计划生成
│   ├── watchlist-engine.js  # 观察名单引擎
│   ├── finnhub.js           # Finnhub 适配器
│   ├── twelvedata.js        # TwelveData 适配器
│   ├── alphavantage.js      # AlphaVantage 适配器
│   ├── fred.js              # FRED 宏观层
│   ├── insider.js           # 内部人士交易层
│   ├── earnings.js          # 财报日历层
│   ├── premarket-scanner.js # 盘前扫描器
│   ├── reddit.js            # WSB 情绪层
│   └── utils.js             # 工具函数
├── index.html               # 主界面（v4：含叙事面板 + 政治交易面板）
├── app.js                   # 前端引擎（v4：renderPoliticalTrades + renderNarrativeEngine）
├── styles.css               # 样式（v4：含新组件样式）
├── config.js                # 配置
└── vercel.json              # Vercel 配置（v4：含 Cron Jobs）
```

---

## 设计理念

> **数据展示不是目的，观点生成才是价值所在。**

本系统将原始数据流（价格、成交量、政治交易、宏观指标）通过引擎层自动提炼为：

1. **市场状态判断**（趋势日 / 风险偏好 / 震荡 / 防御）
2. **政策共振识别**（内部人士 × 热门板块 × 宏观叙事叠加）
3. **执行纪律生成**（基于格局自动生成风险控制建议）

---

## 待办事项

- [ ] 添加单元测试（signal-engine, confidence-score, narrative-engine）
- [ ] 接入 WebSocket 实现价格实时推送（替代轮询）
- [ ] React Query / SWR 前端库升级（替代当前手动缓存层）
- [ ] 历史政治交易数据库（PostgreSQL）积累 Alpha 信号
