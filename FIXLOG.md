# v6.12 → v6.13 修复日志

## 🔴 关键致命 bug（导致数据永远滞后的根本原因）

**`stripInternalMarketStructure is not defined`**

- `api/snapshot.js` 在第 2671、2728 行调用了 `stripInternalMarketStructure()`，但该函数**从未定义**。
- 这是一个运行时 `ReferenceError`，发生在 marketData 已组装完成、快照即将返回之前。
- 后果：**每一次实时构建都崩溃**，`handler` 捕获异常后回退到 Upstash 缓存（`servedFrom: "last-known-good"`），所以你看到的永远是上一次成功写入的旧数据 → 数据滞后 / 无法刷新。
- 同时 `api/daily-report.js` 直接调用 `buildSnapshot()`，也被同一个 bug 拖垮。

**修复**：在 `stripXml` 之后补上函数定义，剥离内部构建进度元数据（`completion`），返回浅拷贝且永不抛错。

验证：在断网沙箱中 `buildSnapshot()` 现在返回 `error: NONE`（此前必抛该 ReferenceError）。

## 🟠 次要修复（非致命，但拉低数据覆盖率）

1. **Reuters RSS 404（feed 已下线）**
   `reutersagency.com` 的 feed 已停用。替换为 Yahoo Finance / CNBC / Investing 三个备用商业新闻源，取第一个有内容的。

2. **SEC EDGAR 403**
   SEC 拒绝通用 User-Agent。`fetchText` 改为支持自定义 header，并给 SEC 请求加上合规的描述性 UA（含联系邮箱占位）。请把 `admin@example.com` 换成你自己的邮箱。

## ⚠️ 已知遗留问题（本次未改，待定）

- **Reddit 403 / SEC**：免费数据源被风控，已有 fallback 不影响主流程。
- **TwelveData "no usable quotes"**：免费档对 NDX/VIX/DXY/XAU 等符号支持有限，已有 Yahoo Chart 兜底（指数实际走的是 Yahoo，状态 delayed，可用）。
- **finnhubInsider `disabled_to_avoid_rate_limit`**：主动禁用以省额度，符合预期。

