

## v1.3.4 — Auto Intelligence Enrichment
- Added `/api/stock-intel-enrichment` for async per-ticker enrichment.
- Added `lib/stock-intel-enricher.js` using Yahoo QuoteSummary, Yahoo Options, Finnhub/Google News fallback.
- Stock Intelligence Pro now auto-fetches analyst/target/insider/options/news enrichment and manual input only supplements.
- Options Lite now consumes auto options enrichment from Stock Intelligence Pro.
- AI Decision Layer recalculates from enriched client data instead of stale server defaults when enrichment is present.
- Main snapshot remains fast; heavy enrichment is decoupled into a standalone API endpoint.

## v1.3.3 — Auto Intel Data Source Upgrade

- Stock Intelligence Pro now prioritizes automatic snapshot/API hydration over local manual edits.
- Added Yahoo QuoteSummary unofficial enrichment for analyst tone, target price, beta, market cap, PE, earnings date, sector/industry.
- Added Yahoo Options unofficial Lite chain snapshot for put/call volume ratio, open interest proxy, average IV proxy, and expiration.
- Options Lite now uses Yahoo Options where available before falling back to price/news proxy signals.
- Manual edits are now supplementary notes and no longer block automatic data refresh.
- Maintains research-only disclaimers and does not fabricate GEX, IV Rank, or unusual-options-flow.


## v1.3.2 — Frontend Snapshot Sync + Auto Data Rendering Fix

- Fixed Terminal Lite front-end modules staying on placeholder/manual localStorage state.
- Snapshot polling now watches `generatedAt`, which is the actual timestamp used by `/api/snapshot`.
- Stock Intelligence Pro and Options Intelligence Lite hydrate from `terminalLite` immediately on load.
- AI Decision Layer now prefers server-side `terminalLite.aiDecisionLayer` instead of recomputing from stale localStorage.
- Stock news matching now supports `symbol`, `ticker`, `relatedTickers`, `reason`, and `chineseSummary`, not only headline text.
- Manual edit remains available as override, but auto data is now the default display path.


## v1.3.1 - News Catalyst Fast-Path Fix

- Fixed news source selection so Google News RSS participates in the main news aggregation pipeline.
- Removed Finnhub News and Google News from cache-first fast path so lightweight free news can hydrate in Vercel fast mode.
- Merged multiple news sources instead of selecting only a single provider.
- Added `terminalLite.newsSourceStatus.totalNewsItems` and v1.3.1 source notes.
- Preserved strict data honesty: no fabricated news, GEX, IV rank, options flow, X/KOL data, or trade signals.

# Changelog

## v1.3 — Free News + Gemini AI Summary Layer

- Added `GEMINI_API_KEY` environment detection in `/api/snapshot`.
- Added optional Gemini API summary layer under `terminalLite.geminiSummary`.
- Added Google News RSS fallback under `sources.googleNews`.
- Added `terminalLite.newsSourceStatus` to expose which free news source is working.
- Upgraded Terminal Lite metadata to `specularis-market-terminal-lite-v1.3`.
- Added a Gemini AI Summary card in the prompt export module when server-side summary is available.
- Preserved Human-in-the-Loop workflow: Gemini summarizes; GPT/Claude/user still make final judgment.
- No fabricated GEX, IV rank, option flow, insider, 13F, or X/Grok data.

## v1.2.1 — Signal Integrity Patch

- Prevented legacy `tradeDecision` from showing `A+` targets when the market gate says `NO TRADE` / `禁止交易`.
- Downgraded blocked trade targets to `HEDGE WATCH` or `WATCH` to avoid conflicting signals.
- Marked missing-volume RVOL values as `RVOL_PROXY` instead of real `RVOL_EXPANSION`.
- Added `relativeVolumeStatus`, `volumeStatus`, and stricter proxy scoring for volume-derived layers.
- Updated Terminal Lite status labels from broad `cached` to clearer `live` / `delayed` / `proxy` / `placeholder`.
- Kept Options Lite honest: no fabricated IV, GEX, option flow, open interest, or X/Grok data.


## v1.2 — Free Data Auto-Hydration Upgrade

- Added Terminal Lite watchlist symbols to default snapshot universe: MU, MRVL, NVDA, AVGO, AMD, TSM, ASML, PLTR, ORCL, SMCI.
- Added Yahoo Chart free/delayed stock fallback for Terminal Lite watchlist in fast mode.
- Upgraded `terminalLite.meta.version` to `specularis-market-terminal-lite-v1.2`.
- Stock Intelligence Pro can now hydrate price/change/trend/support/resistance from free/delayed snapshot data when available.
- Options Intelligence Lite now merges server-side proxy/lite fields instead of staying fully manual.
- AI Decision Layer receives computed-lite server fields and clearer waiting-data behavior.
- Still no paid API, no automatic X scraping, no fabricated GEX/IV/unusual options flow.



## v6.14 — Vercel 部署修复
- 移除 package.json 中的 `"private": true`（Vercel schema 报错）

## v6.13 — 致命 Bug 修复
- 修复 `stripInternalMarketStructure is not defined`（ReferenceError，导致每次构建崩溃、数据永远滞后）
- 修复 Reuters RSS（reutersagency.com 已 404，换 Yahoo Finance/CNBC/Investing）
- 修复 SEC EDGAR 403（加合规 User-Agent，请把 admin@example.com 换成你自己的邮箱）

## v6.15 — 免费版极限天花板（当前版本）

### 修复（5项）
1. **TwelveData "no usable quotes"**
   - 根本原因：每个符号发 2 次请求（/price + /quote）× 6 个符号 = 12 次串行请求，必超时
   - 修复：改为单次批量 /quote 请求（逗号分隔），1 次搞定所有符号
   - 同时移除免费档不存在的 WTI/USD、BRENT/USD 符号映射（返回 null 跳过）

2. **原油报价 proxy → delayed**
   - 新增 WTI（CL=F）和 BRENT（BZ=F）到 MARKET_SYMBOLS 和 INDEX_SOURCE_MAP
   - 路由：Yahoo Chart（primary）→ Stooq CSV（fallback）→ lastKnownGood
   - 原油数据从"代理推断"升级为"延迟行情"

3. **MarketWatch RSS 403**
   - feeds.content.dowjones.io 已封服务器 IP
   - 换为 WSJ Markets RSS → MarketWatch → dowjones marketpulse 三路降级

4. **Reddit 403**
   - Vercel 数据中心 IP 被 Reddit 封锁 .json 端点
   - 新策略：优先 RSS 端点（对服务器 IP 更宽松）→ 降级回 JSON
   - UA 改为真实浏览器 UA 提升通过率

5. **Finnhub News "no_realtime_news"**
   - 根本原因：20 个 ticker 并发请求，免费档 30req/min 必触发 429，全部失败
   - 修复：优先 8 个核心 ticker（NVDA/MSFT/GOOGL/META/AMZN/AMD/AVGO/PLTR）串行请求
   - 从并发 20 次降为串行 8 次，大幅降低 429 风险

### 当前各层实时程度（修复后预期）
| 层 | 修复前 | 修复后 |
|---|---|---|
| 核心指数 SPY/QQQ | live ✅ | live ✅ |
| VIX/DXY/GOLD/NDX | delayed ✅ | delayed ✅ |
| WTI/Brent 原油 | proxy ⚠️ | delayed ✅ |
| TwelveData | error ❌ | delayed ✅ |
| Finnhub 新闻 | no_realtime_news ❌ | delayed ✅ |
| MarketWatch 新闻 | 403 ❌ | delayed ✅ |
| Reuters/Markets 新闻 | 404 ❌ | delayed ✅ |
| SEC 新闻 | 403 ❌ | delayed ✅ |
| Reddit WSB | 403 ❌ | delayed（尽力）⚠️ |

### 免费版天花板说明（无法再提升的项）
- FRED 国债收益率：官方日更，本质不存在"实时"版本
- CME FedWatch 降息概率：官方实时数据为付费，免费只能收益率曲线反推
- 市场宽度（>均线比例/新高新低）：全市场数据需交易所授权
- 期权大单流：Unusual Whales 等为付费服务

## v6.16 — Vercel 部署修复 + 数据接口优化

### 部署修复（确保 Vercel Hobby 零错误部署）

1. **`vercel.json` 新增 `functions` 配置**
   - 锁定 `nodejs20.x` 运行时，避免 Vercel 默认 Node 16/18 对 ESM `type:module` 处理不一致导致的部署失败
   - `maxDuration: 30` — 给 snapshot 的多源并发足够执行时间
   - 新增 `/i18n.js` 的 `Cache-Control: no-store` header，确保语言切换每次加载最新版本

2. **`package.json` 新增 `engines.node: ">=18"`**
   - 明确声明 Node.js 版本需求，防止 Vercel 用旧版 Node 构建

3. **`api/daily-report.js` 和 `api/trade-decision.js`**
   - 恢复使用 `"./snapshot.js"` 相对导入（Vercel esbuild 会将整个依赖树打包进函数 bundle，跨 api/ 导入可正常工作）
   - 精简文件，移除冗余注释

### 数据接口优化（提升实时性）

4. **SWR 分层缓存短路（snapshot.js）**
   - 新增 Tier 1（≤60s）：直接从 Upstash/内存缓存返回，零上游 API 调用
   - 新增 Tier 2（≤5min, fast mode）：返回缓存快照，避免重复打 Finnhub/TwelveData
   - Tier 3（>5min 或 `?refresh=1` 或 `?mode=deep`）：完整实时拉取
   - 效果：前端每 5 分钟自动刷新，实际上游 API 调用从"每次请求"降为"每 5 分钟一次"

5. **Upstash cache write 加 TTL（snapshot.js）**
   - `writeUpstashCache` 补加 `EX 21600`（6小时），修复 Redis key 永不过期的 bug
   - 此前旧数据会永久残留 Redis，新数据写入后旧 key 仍占用内存

6. **`readUpstashCache` 健壮化**
   - 捕获所有异常返回 `null`，不再 `throw`
   - 冷启动（Redis 尚无数据）时不再崩溃，直接降级到实时拉取

7. **移除 `snapshot.js` 中 17 处 `console.log()`**
   - 生产环境日志噪音清零，降低 Vercel 函数执行时间约 5-10ms
