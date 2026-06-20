// api/congress-intel.js — Congress & Social Intelligence Proxy v3.0
// Data sources (all free, no key required):
//   Congress: housestockwatcher.com + senatestockwatcher.com (STOCK Act scrapers)
//   Backup congress: quiverquant.com/quiverapi/v1/live/congresstrading (free CSV)
//   Social: StockTwits public trending endpoint
//   Reddit: reddit.com JSON with proper OAuth-free headers

export const config = { maxDuration: 30 };

const HOUSE_URLS = [
  "https://housestockwatcher.com/api",
  "https://housestockwatcher.com/api/transactions",
];
const SENATE_URLS = [
  "https://senatestockwatcher.com/api",
  "https://senatestockwatcher.com/api/transactions",
];
const QUIVER_URL = "https://api.quiverquant.com/beta/live/congresstrading";
const ST_TRENDING = "https://api.stocktwits.com/api/2/trending/symbols.json?limit=30";
const REDDIT_URLS = [
  "https://www.reddit.com/r/wallstreetbets/hot.json?limit=25&raw_json=1",
  "https://old.reddit.com/r/wallstreetbets/hot.json?limit=25",
];
const REDDIT_STOCKS = "https://www.reddit.com/r/stocks/hot.json?limit=15&raw_json=1";
const REDDIT_INV   = "https://www.reddit.com/r/investing/hot.json?limit=10&raw_json=1";

const WATCHLIST = ["NVDA","MSFT","AAPL","AMD","MRVL","MU","AVGO","TSM","ASML","PLTR","ORCL","SMCI","META","GOOGL","AMZN","TSLA","SPY","QQQ"];
const WL_SET = new Set(WATCHLIST);
const TICKER_RE = /\b([A-Z]{1,5})\b/g;
const EXCLUDED = new Set(["A","I","AN","AT","BE","BY","DO","IF","IN","IS","IT","MY","NO","OF","OK","ON","OR","SO","THE","TO","UP","WE"]);

function respond(res, data) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json(data);
}

// Robust fetch with timeout and retry on different URLs
async function tryFetch(urls, headers = {}, timeoutMs = 8000) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  for (const url of urlList) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Specularis/7.2; research tool)",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          ...headers,
        },
      });
      clearTimeout(timer);
      if (r.ok) {
        const ct = r.headers.get("content-type") || "";
        if (ct.includes("json")) return await r.json();
        const text = await r.text();
        try { return JSON.parse(text); } catch { continue; }
      }
    } catch { clearTimeout(timer); }
  }
  return null;
}

// ── Congress data ─────────────────────────────────────────────────────────────
function normalizeTrade(t, chamber) {
  const ticker = ((t.ticker || t.Ticker || t.symbol || "")
    .replace(/\$/g, "").replace(/\s/g, "").toUpperCase().split(/[^A-Z]/)[0] || "").trim();
  const type = t.type || t.Type || t.transaction_type || t.TransactionType || "–";
  const date = (
    t.transaction_date || t.TransactionDate ||
    t.disclosure_date || t.DisclosureDate ||
    t.filed_at || t.FiledAt || ""
  ).slice(0, 10);
  const member = (
    t.representative || t.Representative ||
    t.senator || t.Senator ||
    t.member_name || t.MemberName || t.name || t.Name || "Unknown"
  ).trim();
  return {
    chamber, member, ticker,
    company: (t.asset_description || t.AssetDescription || t.company || t.Company || "").slice(0, 50),
    type, date,
    amount: t.amount || t.Amount || t.transaction_amount || "–",
    state: (t.district || t.District || t.state || t.State || "").trim(),
    isWL: WL_SET.has(ticker),
    isBuy: /pur|buy|acqui/i.test(type),
  };
}

async function getHouse() {
  const d = await tryFetch(HOUSE_URLS);
  if (!d) return { ok: false, trades: [] };
  const arr = Array.isArray(d) ? d : (d.data || d.transactions || d.results || []);
  if (!Array.isArray(arr) || !arr.length) return { ok: false, trades: [] };
  const cutoff = Date.now() - 90 * 86400000;
  const trades = arr
    .filter(t => {
      const dateStr = t.transaction_date || t.TransactionDate || t.disclosure_date || t.filed_at || "";
      return dateStr && new Date(dateStr) >= cutoff;
    })
    .sort((a, b) => {
      const da = new Date(a.transaction_date || a.disclosure_date || 0);
      const db = new Date(b.transaction_date || b.disclosure_date || 0);
      return db - da;
    })
    .slice(0, 120)
    .map(t => normalizeTrade(t, "众议院"))
    .filter(t => t.ticker && t.ticker.length >= 1 && t.ticker.length <= 5);
  return { ok: trades.length > 0, trades };
}

async function getSenate() {
  const d = await tryFetch(SENATE_URLS);
  if (!d) return { ok: false, trades: [] };
  const arr = Array.isArray(d) ? d : (d.data || d.transactions || d.results || []);
  if (!Array.isArray(arr) || !arr.length) return { ok: false, trades: [] };
  const cutoff = Date.now() - 90 * 86400000;
  const trades = arr
    .filter(t => {
      const dateStr = t.transaction_date || t.TransactionDate || t.disclosure_date || t.filed_at || "";
      return dateStr && new Date(dateStr) >= cutoff;
    })
    .sort((a, b) => {
      const da = new Date(a.transaction_date || a.disclosure_date || 0);
      const db = new Date(b.transaction_date || b.disclosure_date || 0);
      return db - da;
    })
    .slice(0, 80)
    .map(t => normalizeTrade(t, "参议院"))
    .filter(t => t.ticker && t.ticker.length >= 1 && t.ticker.length <= 5);
  return { ok: trades.length > 0, trades };
}

// QuiverQuant as fallback for congress data (no key for basic endpoint)
async function getQuiverCongress() {
  const d = await tryFetch(QUIVER_URL);
  if (!d || !Array.isArray(d)) return null;
  const cutoff = Date.now() - 90 * 86400000;
  return d
    .filter(t => t.Date && new Date(t.Date) >= cutoff)
    .sort((a, b) => new Date(b.Date) - new Date(a.Date))
    .slice(0, 100)
    .map(t => ({
      chamber: t.Chamber === "Senate" ? "参议院" : "众议院",
      member: t.Name || "Unknown",
      ticker: (t.Ticker || "").toUpperCase().trim(),
      company: t.Asset || "",
      type: t.Transaction || "–",
      date: t.Date?.slice(0, 10) || "",
      amount: t.Range || "–",
      state: t.State || "",
      isWL: WL_SET.has((t.Ticker || "").toUpperCase().trim()),
      isBuy: /pur|buy/i.test(t.Transaction || ""),
    }))
    .filter(t => t.ticker && t.ticker.length <= 5);
}

// ── Social: StockTwits ────────────────────────────────────────────────────────
async function getTrending() {
  const d = await tryFetch(ST_TRENDING);
  if (!d?.symbols) return { ok: false, symbols: [] };
  return {
    ok: true,
    symbols: d.symbols.slice(0, 20).map(s => {
      // StockTwits free API: bull_percent may not be reliable, show N/A if null/50
      const bullRaw = s.symbol_sentiment?.bull_percent;
      const bullPct = (bullRaw != null && bullRaw !== 50) ? bullRaw : null;
      return {
        symbol:   s.symbol,
        title:    s.title || "",
        watchlist:s.watchlist_count || 0,
        messages: s.messages_count || s.message_count || 0,
        bullPct,    // null means no real sentiment data
        change:   s.prices?.last?.change_percent ?? null,
        isWL:     WL_SET.has(s.symbol),
      };
    }),
  };
}

// ── Social: Reddit ────────────────────────────────────────────────────────────
function parseRedditPosts(data, sub) {
  if (!data?.data?.children) return [];
  return data.data.children
    .filter(c => c.kind === "t3" && !c.data?.stickied && (c.data?.score || 0) > 5)
    .map(c => {
      const p = c.data || {};
      const text = `${p.title || ""} ${(p.selftext || "").slice(0, 400)}`;
      const tickers = [...new Set(
        (text.match(TICKER_RE) || [])
          .filter(t => t.length >= 2 && t.length <= 5 && !EXCLUDED.has(t) && WL_SET.has(t))
      )];
      return {
        sub,
        title:    (p.title || "").slice(0, 160),
        score:    p.score || 0,
        comments: p.num_comments || 0,
        created:  new Date((p.created_utc || 0) * 1000).toISOString(),
        tickers,
        flair:    (p.link_flair_text || "").slice(0, 24),
        url:      `https://reddit.com${p.permalink || ""}`,
      };
    });
}

async function getReddit() {
  const [wsbData, stkData, invData] = await Promise.all([
    tryFetch(REDDIT_URLS, { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }),
    tryFetch([REDDIT_STOCKS], { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }),
    tryFetch([REDDIT_INV],    { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }),
  ]);

  const all = [
    ...parseRedditPosts(wsbData,  "wallstreetbets"),
    ...parseRedditPosts(stkData,  "stocks"),
    ...parseRedditPosts(invData,  "investing"),
  ].sort((a, b) => b.score - a.score);

  // Ticker frequency weighted by score
  const freq = {};
  for (const p of all)
    for (const t of p.tickers)
      freq[t] = (freq[t] || 0) + 1 + Math.log1p(p.score / 100);

  const hotTickers = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([symbol, heat]) => ({ symbol, heat: Math.round(heat * 10) / 10 }));

  return {
    ok:         all.length > 0,
    posts:      all.slice(0, 20),
    hotTickers,
  };
}

// ── Synthesis ─────────────────────────────────────────────────────────────────
function buildIntel(hTrades, sTrades, trending, reddit) {
  const all = [...hTrades, ...sTrades];
  const activity = {};
  for (const t of all) {
    const sym = t.ticker;
    if (!sym || sym.length < 1 || sym.length > 5) continue;
    if (!activity[sym]) activity[sym] = { buys: 0, sells: 0, members: new Set(), isWL: t.isWL };
    if (t.isBuy) activity[sym].buys++; else activity[sym].sells++;
    activity[sym].members.add(t.member);
  }
  const actRank = Object.entries(activity)
    .map(([sym, v]) => ({
      symbol: sym, buys: v.buys, sells: v.sells,
      members: v.members.size, net: v.buys - v.sells, isWL: v.isWL,
    }))
    .sort((a, b) => (b.buys + b.sells) - (a.buys + a.sells))
    .slice(0, 16);

  const socialHot = new Set([
    ...(trending.symbols || []).map(s => s.symbol),
    ...(reddit.hotTickers || []).map(h => h.symbol),
  ]);

  return {
    actRank,
    confluence: actRank.filter(r => socialHot.has(r.symbol)).slice(0, 8),
    wlTrades:   all.filter(t => t.isWL).sort((a, b) => new Date(b.date||0) - new Date(a.date||0)).slice(0, 25),
    total:      all.length,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(_req, res) {
  const [house, senate, trending, reddit] = await Promise.all([
    getHouse(), getSenate(), getTrending(), getReddit(),
  ]);

  // Quiver fallback if both congress sources fail
  let finalHouse = house, finalSenate = senate;
  if (!house.ok && !senate.ok) {
    const quiver = await getQuiverCongress();
    if (quiver) {
      finalHouse  = { ok: true, trades: quiver.filter(t => t.chamber === "众议院") };
      finalSenate = { ok: true, trades: quiver.filter(t => t.chamber === "参议院"), _source: "quiverquant" };
    }
  }

  const intel = buildIntel(finalHouse.trades, finalSenate.trades, trending, reddit);

  respond(res, {
    generatedAt: new Date().toISOString(),
    sources: {
      house:      finalHouse.ok  ? (finalHouse._source  || "live") : "unavailable",
      senate:     finalSenate.ok ? (finalSenate._source || "live") : "unavailable",
      stocktwits: trending.ok  ? "live" : "unavailable",
      reddit:     reddit.ok    ? "live" : "unavailable",
    },
    congress: { house: finalHouse, senate: finalSenate },
    social:   { trending, reddit },
    intel,
  });
}
