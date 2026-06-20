// api/congress-intel.js — Vercel Serverless Proxy
// Fetches congress trading + social data server-side (avoids browser CORS blocks)
// No API keys required. All sources are free public endpoints.
// Total functions: 7 (Hobby limit: 12)

const HOUSE_API   = "https://housestockwatcher.com/api";
const SENATE_API  = "https://senatestockwatcher.com/api";
const ST_TRENDING = "https://api.stocktwits.com/api/2/trending/symbols.json?limit=30";
const ST_STREAM   = (s) => `https://api.stocktwits.com/api/2/streams/symbol/${s}.json?limit=8`;
const REDDIT_WSB  = "https://www.reddit.com/r/wallstreetbets/hot.json?limit=25";
const REDDIT_STKS = "https://www.reddit.com/r/stocks/hot.json?limit=15";
const REDDIT_INV  = "https://www.reddit.com/r/investing/hot.json?limit=10";
const WATCHLIST   = ["NVDA","MSFT","AAPL","AMD","MRVL","MU","AVGO","TSM","ASML","PLTR","ORCL","SMCI","META","GOOGL","AMZN","TSLA","SPY","QQQ"];
const WL_SET      = new Set(WATCHLIST);
const TICKER_RE   = /\b([A-Z]{2,5})\b/g;

function noStore(res, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=900, stale-while-revalidate=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json(data);
}

async function safeGet(url, extraHeaders = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Specularis/7.1 (research)", Accept: "application/json", ...extraHeaders },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { clearTimeout(t); return null; }
}

function normTrade(t, chamber) {
  const ticker = (t.ticker || "").replace(/\$/g, "").toUpperCase().trim();
  return {
    chamber,
    member:  t.representative || t.senator || t.member_name || t.name || "Unknown",
    ticker,
    company: (t.asset_description || t.company || "").slice(0, 48),
    type:    t.type || t.transaction_type || "–",
    amount:  t.amount || t.transaction_amount || "–",
    date:    (t.transaction_date || t.disclosure_date || t.filed_at || "").slice(0, 10),
    state:   t.district || t.state || "",
    isWL:    WL_SET.has(ticker),
  };
}

async function getHouse() {
  const d = await safeGet(HOUSE_API);
  if (!d) return { ok: false, trades: [] };
  const arr = Array.isArray(d) ? d : (d.data || d.transactions || []);
  const cutoff = Date.now() - 90 * 86400000;
  const trades = arr
    .filter(t => new Date(t.transaction_date || t.disclosure_date || 0) >= cutoff)
    .sort((a, b) => new Date(b.transaction_date || b.disclosure_date || 0) - new Date(a.transaction_date || a.disclosure_date || 0))
    .slice(0, 100).map(t => normTrade(t, "众议院"));
  return { ok: true, trades };
}

async function getSenate() {
  const d = await safeGet(SENATE_API);
  if (!d) return { ok: false, trades: [] };
  const arr = Array.isArray(d) ? d : (d.data || d.transactions || []);
  const cutoff = Date.now() - 90 * 86400000;
  const trades = arr
    .filter(t => new Date(t.transaction_date || t.disclosure_date || 0) >= cutoff)
    .sort((a, b) => new Date(b.transaction_date || b.disclosure_date || 0) - new Date(a.transaction_date || a.disclosure_date || 0))
    .slice(0, 80).map(t => normTrade(t, "参议院"));
  return { ok: true, trades };
}

async function getTrending() {
  const d = await safeGet(ST_TRENDING);
  if (!d?.symbols) return { ok: false, symbols: [] };
  return {
    ok: true,
    symbols: d.symbols.slice(0, 16).map(s => ({
      symbol:   s.symbol, title: s.title || "",
      watchlist:s.watchlist_count || 0, messages: s.messages_count || 0,
      bullPct:  s.symbol_sentiment?.bull_percent ?? 50,
      bearPct:  s.symbol_sentiment?.bear_percent ?? 50,
      change:   s.prices?.last?.change_percent ?? null,
      isWL:     WL_SET.has(s.symbol),
    })),
  };
}

async function getWLSentiment() {
  const tickers = ["NVDA","AMD","PLTR","META","TSLA","SPY","QQQ"];
  const results = await Promise.allSettled(tickers.map(async sym => {
    const d = await safeGet(ST_STREAM(sym));
    if (!d?.messages) return null;
    const bull = d.messages.filter(m => m.entities?.sentiment?.basic === "Bullish").length;
    const bear = d.messages.filter(m => m.entities?.sentiment?.basic === "Bearish").length;
    const total = bull + bear || 1;
    return {
      symbol: sym, bullPct: Math.round(bull/total*100), bearPct: Math.round(bear/total*100),
      preview: d.messages.slice(0,1).map(m => ({
        text: (m.body||"").slice(0,100), sentiment: m.entities?.sentiment?.basic||"", user: m.user?.username||"",
      })),
    };
  }));
  return results.filter(r => r.status==="fulfilled" && r.value).map(r => r.value);
}

async function getPosts(url, sub) {
  const d = await safeGet(url, { "User-Agent": "Specularis/7.1" });
  return (d?.data?.children||[])
    .filter(c => c.kind==="t3" && !c.data.stickied && (c.data.score||0) > 5)
    .map(c => {
      const p = c.data;
      const text = `${p.title||""} ${(p.selftext||"").slice(0,300)}`;
      const tickers = [...new Set((text.match(TICKER_RE)||[]).filter(t => WL_SET.has(t)))];
      return { sub, title:(p.title||"").slice(0,140), score:p.score||0, comments:p.num_comments||0,
               created:new Date((p.created_utc||0)*1000).toISOString(), tickers, flair:(p.link_flair_text||"").slice(0,20) };
    });
}

async function getReddit() {
  const [wsb,stk,inv] = await Promise.all([getPosts(REDDIT_WSB,"wallstreetbets"),getPosts(REDDIT_STKS,"stocks"),getPosts(REDDIT_INV,"investing")]);
  const all = [...wsb,...stk,...inv].sort((a,b)=>b.score-a.score);
  const freq = {};
  for (const p of all) for (const t of p.tickers) freq[t] = (freq[t]||0)+1+Math.log1p(p.score/200);
  const hotTickers = Object.entries(freq).sort(([,a],[,b])=>b-a).slice(0,10).map(([symbol,heat])=>({symbol,heat:Math.round(heat*10)/10}));
  return { ok: all.length>0, posts: all.slice(0,18), hotTickers };
}

function synthesize(house, senate, trending, reddit) {
  const all = [...house.trades,...senate.trades];
  const act = {};
  for (const t of all) {
    const sym = t.ticker;
    if (!sym||sym.length<1||sym.length>5) continue;
    if (!act[sym]) act[sym]={buys:0,sells:0,members:new Set(),isWL:t.isWL};
    if (/pur|buy|acqui/i.test(t.type)) act[sym].buys++; else act[sym].sells++;
    act[sym].members.add(t.member);
  }
  const actRank = Object.entries(act)
    .map(([sym,v])=>({symbol:sym,buys:v.buys,sells:v.sells,members:v.members.size,net:v.buys-v.sells,isWL:v.isWL}))
    .sort((a,b)=>(b.buys+b.sells)-(a.buys+a.sells)).slice(0,14);
  const socialHot = new Set([...(trending.symbols||[]).map(s=>s.symbol),...(reddit.hotTickers||[]).map(h=>h.symbol)]);
  return {
    actRank, confluence: actRank.filter(r=>socialHot.has(r.symbol)),
    wlTrades: all.filter(t=>t.isWL).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).slice(0,20),
    total: all.length,
  };
}

export default async function handler(_req, res) {
  const [house, senate, trending, wlSentiment, reddit] = await Promise.all([
    getHouse(), getSenate(), getTrending(), getWLSentiment(), getReddit(),
  ]);
  const intel = synthesize(house, senate, trending, reddit);
  noStore(res, {
    generatedAt: new Date().toISOString(),
    sources: {
      house:      house.ok    ? "live" : "unavailable",
      senate:     senate.ok   ? "live" : "unavailable",
      stocktwits: trending.ok ? "live" : "unavailable",
      reddit:     reddit.ok   ? "live" : "unavailable",
    },
    congress: { house, senate },
    social:   { trending, wlSentiment, reddit },
    intel,
  });
}
