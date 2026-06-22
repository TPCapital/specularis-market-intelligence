function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function pct(value) {
  const n = Number(value || 0);
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function pickChange(indices = [], id) {
  return Number((indices || []).find((item) => item.id === id)?.change || 0);
}

function normalizeSignal(signal = '') {
  const s = String(signal || '').toUpperCase();
  if (s.includes('PUT') || s.includes('HEDGE')) return 'PUT / HEDGE WATCH';
  if (s.includes('LONG') || s.includes('CALL') || s.includes('HIGH CONVICTION')) return 'CALL PRIORITY';
  if (s.includes('BREAKOUT')) return 'BREAKOUT WATCH';
  return 'WATCHLIST';
}

function gradeByScore(score) {
  const n = clamp(score);
  if (n >= 86) return 'A+';
  if (n >= 76) return 'A';
  if (n >= 64) return 'B';
  if (n >= 52) return 'C';
  return 'NO TRADE';
}

function directionByContext({ riskMode, signal, change = 0, score = 0 }) {
  const s = String(signal || '').toUpperCase();
  if (s.includes('PUT') || s.includes('HEDGE')) return 'PUT / HEDGE';
  if (riskMode === 'Risk-Off' && change < 0) return 'PUT / HEDGE';
  if (score >= 72 && change >= -0.25 && riskMode !== 'Risk-Off') return 'CALL';
  if (change < -1.5) return 'PUT / HEDGE';
  return 'WAIT';
}

function confidenceFrom(score, dataConfidence = 'MEDIUM') {
  const q = String(dataConfidence || '').toUpperCase();
  if (score >= 82 && ['HIGH', 'MEDIUM'].includes(q)) return '高';
  if (score >= 68) return '中高';
  if (score >= 55) return '中';
  return '低';
}

function extractItems({ watchlist = {}, scanner = [], premarketMomentum = {}, relativeVolume = {}, marketData = {}, newsCatalysts = {}, optionsSignals = {} } = {}) {
  const bySymbol = new Map();
  const add = (item = {}, source = '') => {
    const symbol = item.symbol || item.ticker;
    if (!symbol || String(symbol).includes('暂无')) return;
    const current = bySymbol.get(symbol) || { symbol, sources: [] };
    const merged = { ...current, ...item, symbol, sources: [...new Set([...(current.sources || []), source].filter(Boolean))] };
    const baseScore = Number(current.score || current.momentumScore || current.heat || 0);
    const newScore = Number(item.score || item.momentumScore || item.heat || 0);
    merged.score = Math.max(baseScore, newScore, Number(merged.score || 0));
    bySymbol.set(symbol, merged);
  };
  (watchlist.strong || []).forEach((item) => add(item, 'watchlist-strong'));
  (watchlist.watch || []).forEach((item) => add(item, 'watchlist-watch'));
  (scanner || []).forEach((item) => add(item, 'scanner'));
  (premarketMomentum.leaders || premarketMomentum || []).forEach?.((item) => add(item, 'premarket-momentum'));
  (relativeVolume.leaders || []).forEach((item) => add(item, 'relative-volume'));
  (optionsSignals || []).forEach?.((item) => add(item, 'options-proxy'));
  (newsCatalysts.movers || []).forEach((item) => add(item, 'news-mover'));
  const quoteMap = new Map((marketData.quotes || []).map((item) => [item.symbol, item]));
  return [...bySymbol.values()].map((item) => {
    const quote = quoteMap.get(item.symbol) || {};
    return { ...quote, ...item };
  });
}

function buildTarget(item, context = {}, index = 0) {
  const score = clamp(Number(item.score || item.momentumScore || item.heat || 0) || (60 - index * 2));
  const change = Number(item.changePercent ?? item.change ?? item.premarketPercent ?? 0);
  const signal = normalizeSignal(item.signal || item.status || item.direction || item.conviction);
  const direction = directionByContext({ riskMode: context.riskMode, signal, change, score });
  const grade = gradeByScore(score + (context.riskMode === 'Risk-On' && direction === 'CALL' ? 4 : 0));
  const confidence = confidenceFrom(score, context.dataConfidence);
  const probability = clamp(Math.round(score * 0.62 + (context.riskScore || 50) * 0.28 + (change > 0 ? 6 : -3)));
  const optionStyle = probability >= 76 && direction === 'CALL' ? '0DTE / 1DTE 顺势轻仓' : direction === 'PUT / HEDGE' ? '1DTE PUT / 对冲观察' : '观察，不主动开仓';
  const reasons = [
    item.sector || item.theme ? `${item.sector || item.theme} 主线` : '',
    score >= 75 ? '机会评分较高' : '需要开盘确认',
    change ? `价格变化 ${pct(change)}` : '',
    (item.sources || []).length ? `来源 ${item.sources.slice(0, 3).join(' / ')}` : ''
  ].filter(Boolean);
  const entryTrigger = direction === 'CALL'
    ? `${item.symbol} 开盘后站上 VWAP，5分钟量能放大，QQQ/SPY 同向。`
    : direction === 'PUT / HEDGE'
      ? `${item.symbol} 跌破开盘区间低点，QQQ/SPY 同步走弱，VIX 不回落。`
      : `${item.symbol} 等待开盘15分钟确认方向，不抢第一根。`;
  const invalidation = direction === 'CALL'
    ? '跌回 VWAP 下方且量能衰竭，取消追涨。'
    : direction === 'PUT / HEDGE'
      ? '重新站回 VWAP 上方且大盘转强，取消PUT。'
      : '无量、冲高回落或与板块背离则放弃。';
  const risk = score >= 82 ? '中：强势但防追高' : score >= 65 ? '中高：等待确认' : '高：只观察';
  return {
    symbol: item.symbol,
    sector: item.sector || item.theme || '核心观察',
    grade,
    score: Math.round(score),
    probability,
    direction,
    confidence,
    optionStyle,
    entryTrigger,
    invalidation,
    risk,
    reasons,
    sources: item.sources || [],
    changePercent: change
  };
}

export function buildTradeDecision({
  marketRegime = {},
  riskRegime = {},
  strategySummary = {},
  tradePlan = {},
  watchlist = {},
  signalEngine = {},
  marketStructurePro = {},
  marketBreadth = {},
  premarketMomentum = {},
  relativeVolume = {},
  marketData = {},
  newsCatalysts = {},
  optionsSignals = [],
  confidenceScore = {},
  scanner = []
} = {}) {
  const riskMode = riskRegime.mode || (marketRegime.type === 'RISK_OFF' ? 'Risk-Off' : marketRegime.type === 'RISK_ON' || marketRegime.type === 'TREND_DAY' ? 'Risk-On' : 'Neutral');
  const riskScore = Number(riskRegime.score ?? signalEngine.riskAppetite ?? 50);
  const dataConfidence = confidenceScore.tradeConfidence || confidenceScore.dataConfidence || 'MEDIUM';
  const indices = marketData.indices || [];
  const qqq = pickChange(indices, 'QQQ');
  const spy = pickChange(indices, 'SPY');
  const vix = pickChange(indices, 'VIX');
  const breadthScore = Number(marketBreadth.breadthStrength || marketStructurePro?.breadthPro?.score || 50);
  const fedBias = marketStructurePro?.fedWatch?.bias || marketStructurePro?.fedWatch?.verdict || 'proxy';
  const riskPenalty = Math.max(0, vix) * 2 + (riskMode === 'Risk-Off' ? 12 : 0);
  const baseScore = clamp(50 + qqq * 4 + spy * 3 - riskPenalty + (breadthScore - 50) * 0.25 + (riskScore - 50) * 0.35);
  const targets = extractItems({ watchlist, scanner, premarketMomentum, relativeVolume, marketData, newsCatalysts, optionsSignals })
    .map((item, index) => buildTarget(item, { riskMode, riskScore, dataConfidence }, index))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const actionableTargets = targets.filter((item) => ['A+', 'A', 'B'].includes(item.grade));
  const top = actionableTargets[0] || targets[0] || null;
  let direction = 'WAIT';
  if (riskMode === 'Risk-On' && top?.direction === 'CALL' && baseScore >= 56) direction = 'CALL';
  else if (riskMode === 'Risk-Off' || top?.direction === 'PUT / HEDGE') direction = 'PUT / HEDGE';
  const grade = baseScore >= 80 && actionableTargets.length >= 2 ? 'A+' : baseScore >= 68 && actionableTargets.length >= 1 ? 'A' : baseScore >= 56 ? 'B' : baseScore >= 45 ? 'C' : 'NO TRADE';
  const permission = grade === 'A+' || grade === 'A' ? '允许进攻' : grade === 'B' ? '轻仓观察' : grade === 'C' ? '只看不做' : '禁止交易';
  const actionBias = direction === 'CALL'
    ? 'CALL 优先'
    : direction === 'PUT / HEDGE'
      ? 'PUT / 对冲观察'
      : '等待确认';
  const title = `${grade}｜${actionBias}`;
  const summary = top
    ? `当前${riskMode === 'Risk-On' ? '风险偏好较好' : riskMode === 'Risk-Off' ? '风险偏好转弱' : '市场仍需确认'}，优先观察 ${top.symbol}。${top.entryTrigger}`
    : '暂无高质量交易目标，等待开盘量价确认。';
  const focus = actionableTargets.slice(0, 5).map((item) => `${item.symbol}｜${item.grade}｜${item.direction}｜${item.entryTrigger}`);
  const avoid = [
    vix > 2 ? 'VIX 快速上行时避免追CALL。' : '',
    breadthScore < 45 ? '市场宽度偏弱，避免只看个股强势。' : '',
    '无量高开、跌回 VWAP、与板块背离的信号全部放弃。',
    '连续亏损后停止加仓，避免情绪化翻倍。'
  ].filter(Boolean);
  const checklist = [
    { label: '大盘同向', pass: qqq >= -0.15 && spy >= -0.15, detail: `QQQ ${pct(qqq)} / SPY ${pct(spy)}` },
    { label: '波动率可控', pass: vix <= 2.5, detail: `VIX ${pct(vix)}` },
    { label: '宽度支持', pass: breadthScore >= 48, detail: `Breadth ${Math.round(breadthScore)}` },
    { label: '有可交易目标', pass: actionableTargets.length > 0, detail: `${actionableTargets.length} 个 B级以上` },
    { label: '等待开盘确认', pass: true, detail: 'VWAP / RVOL / 板块共振' }
  ];
  return {
    version: 'P4 Trade Decision Engine v1',
    generatedAt: Date.now(),
    grade,
    score: Math.round(baseScore),
    probability: clamp(Math.round(baseScore * 0.78 + actionableTargets.length * 4)),
    direction,
    permission,
    actionBias,
    title,
    summary,
    marketGate: {
      mode: riskMode,
      permission,
      reason: `${riskMode} · QQQ ${pct(qqq)} · SPY ${pct(spy)} · VIX ${pct(vix)} · Breadth ${Math.round(breadthScore)}`,
      fedBias
    },
    targets,
    topTarget: top,
    focus,
    avoid,
    checklist,
    riskControl: {
      maxRiskPerTrade: '账户 1%-2%',
      maxAttempts: grade === 'A+' || grade === 'A' ? 2 : 1,
      stopRule: '期权亏损 25%-35% 或正股信号失效立即离场。',
      timeRule: '0DTE 不持有无量横盘，下午时间衰减优先于幻想反弹。'
    },
    executionRules: [
      '开盘前只做计划，不抢盘前K线。',
      '开盘后先确认 QQQ/SPY/VIX，再确认目标股。',
      '只做主线共振，不做孤立异动。',
      'B级以下只观察，不开仓。'
    ],
    dataQuality: ['HIGH', 'MEDIUM'].includes(String(dataConfidence).toUpperCase()) ? 'decision-ready' : 'proxy-watch',
    confidence: confidenceFrom(baseScore, dataConfidence),
    source: 'Trade Decision Engine v1 · proxy + market structure'
  };
}
