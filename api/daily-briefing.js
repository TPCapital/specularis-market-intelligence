// api/daily-briefing.js — Horizon-style daily briefing generator
// Aggregates news by theme, scores importance, returns structured briefing.
// No LLM required — rule-based aggregation. Supports optional Anthropic AI summary.

export const config = { maxDuration: 30 };

const NEWS_THEMES = [
  { key:"ai_semi",   label:"AI / 半导体", keywords:/\b(AI|nvidia|amd|gpu|semiconductor|chip|TSM|ASML|Broadcom|Marvell|NVDA)\b/i },
  { key:"macro",     label:"宏观 / 利率", keywords:/\b(fed|rate|yield|inflation|CPI|PCE|powell|FOMC|treasury|bond)\b/i },
  { key:"cloud",     label:"云计算 / 软件",keywords:/\b(cloud|SaaS|microsoft|amazon|google|azure|AWS|oracle|MSFT|AMZN|GOOGL)\b/i },
  { key:"crypto",    label:"加密 / 风险", keywords:/\b(bitcoin|crypto|ETH|coinbase|microstrategy|BTC|COIN|MSTR)\b/i },
  { key:"geopolit",  label:"地缘 / 政策", keywords:/\b(tariff|sanction|china|trade|congress|regulation|export|ban)\b/i },
];

function scoreImportance(item) {
  const text = `${item.title||""} ${item.summary||""}`;
  let s = 5;
  if (/\bEARNING|BEAT|MISS|GUIDANCE|UPGRADE|DOWNGRADE\b/i.test(text)) s += 4;
  if (/\bFED|FOMC|RATE|INFLATION|GDP\b/i.test(text)) s += 3;
  if (/\bNVDA|AMD|MSFT|AAPL|META|GOOGL|AMZN|TSLA\b/i.test(text)) s += 2;
  return Math.min(s, 10);
}

async function fetchAllNews() {
  const sources = [
    "https://finance.yahoo.com/news/rssindex?market=us",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  ];
  const items = [];
  for (const url of sources) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Specularis/9.0 research tool" }});
      const text = await r.text();
      const titles = [...text.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g)].map(m=>m[1]);
      titles.forEach(t => items.push({ title:t, datetime: Date.now() }));
    } catch {}
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=900");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const newsItems = await fetchAllNews();
  const buckets = {};
  NEWS_THEMES.forEach(t => { buckets[t.key] = { ...t, items: [] }; });

  for (const item of newsItems) {
    const text = item.title||"";
    for (const theme of NEWS_THEMES) {
      if (theme.keywords.test(text)) { buckets[theme.key].items.push(item); break; }
    }
  }

  const briefing = Object.values(buckets).filter(b=>b.items.length>0).map(theme => ({
    theme: theme.label,
    key: theme.key,
    count: theme.items.length,
    topItems: [...theme.items].sort((a,b)=>scoreImportance(b)-scoreImportance(a)).slice(0,3).map(item => ({
      title: item.title,
      importance: scoreImportance(item),
    }))
  }));

  res.status(200).json({
    generatedAt: new Date().toISOString(),
    source: "Horizon News Radar v9",
    totalItems: newsItems.length,
    briefing,
  });
}
