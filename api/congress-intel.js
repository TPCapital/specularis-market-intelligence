// api/congress-intel.js
// Specularis Market Intelligence — Congress Trading Intel Module
// Free data sources (no API key required):
//   • housestockwatcher.com/api  — House of Representatives disclosures
//   • senatestockwatcher.com/api — Senate disclosures
//   • api.stocktwits.com/api/2  — Public social sentiment (no key)
//   • reddit.com/r/wallstreetbets + r/stocks JSON feeds
// All sources are public, STOCK Act compliance databases or open social feeds.

import { json } from "../lib/utils.js";

const HOUSE_API   = "https://housestockwatcher.com/api";
const SENATE_API  = "https://senatestockwatcher.com/api";
const ST_TRENDING = "https://api.stocktwits.com/api/2/trending/symbols.json?limit=30";
const ST_STREAM   = (sym) => `https://api.stocktwits.com/api/2/streams/symbol/${sym}.json?limit=10`;
const REDDIT_WSB  = "https://www.reddit.com/r/wallstreetbets/hot.json?limit=25&t=day";
const REDDIT_STKS = "https://www.reddit.com/r/stocks/hot.json?limit=15&t=day";
const REDDIT_INV  = "https://www.reddit.com/r/investing/hot.json?limit=10&t=day";

const FETCH_TIMEOUT = 8000;
const WATCHLIST = ["NVDA","MSFT","AAPL","AMD","MRVL","MU","AVGO","TSM","ASML","PLTR","ORCL","SMCI","META","GOOGL","AMZN","TSLA","SPY","QQQ"];

// ── helpers ──────────────────────────────────────────────────────────────────
async function safeFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Specularis-Market-Terminal/7.0 (educational research tool)",
        Accept: "application/json",
        ...(opts.headers || {}),
      },
      ...opts,
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

// Filter to recent N days
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function parseDate(str) {
  if (!str) return null;
  try { return new Date(str); } catch { return null; }
}

// ── Congress data ─────────────────────────────────────────────────────────────
async function fetchHouseTrades() {
  const data = await safeFetch(HOUSE_API);
  if (!data) return { status: "unavailable", trades: [] };
  const arr = Array.isArray(data) ? data : (data.data || data.transactions || []);
  const cutoff = daysAgo(90);
  const trades = arr
    .filter((t) => {
      const d = parseDate(t.transaction_date || t.disclosure_date || t.filed_at);
      return d && d >= cutoff;
    })
    .sort((a, b) => {
      const da = parseDate(a.transaction_date || a.disclosure_date || a.filed_at) || new Date(0);
      const db = parseDate(b.transaction_date || b.disclosure_date || b.filed_at) || new Date(0);
      return db - da;
    })
    .slice(0, 80)
    .map((t) => ({
      chamber:    "House",
      member:     t.representative || t.member_name || t.name || "Unknown",
      ticker:     (t.ticker || t.asset_name || "").replace("$", "").toUpperCase().trim(),
      company:    t.asset_description || t.company || t.description || "",
      type:       t.type || t.transaction_type || "–",
      amount:     t.amount || t.transaction_amount || "–",
      date:       t.transaction_date || t.disclosure_date || t.filed_at || "",
      district:   t.district || t.state || "",
      party:      t.party || "",
      isWatchlist: WATCHLIST.includes((t.ticker || "").replace("$", "").toUpperCase().trim()),
    }));
  return { status: "live", trades };
}

async function fetchSenateTrades() {
  const data = await safeFetch(SENATE_API);
  if (!data) return { status: "unavailable", trades: [] };
  const arr = Array.isArray(data) ? data : (data.data || data.transactions || []);
  const cutoff = daysAgo(90);
  const trades = arr
    .filter((t) => {
      const d = parseDate(t.transaction_date || t.disclosure_date || t.filed_at);
      return d && d >= cutoff;
    })
    .sort((a, b) => {
      const da = parseDate(a.transaction_date || a.disclosure_date || a.filed_at) || new Date(0);
      const db = parseDate(b.transaction_date || b.disclosure_date || b.filed_at) || new Date(0);
      return db - da;
    })
    .slice(0, 60)
    .map((t) => ({
      chamber:    "Senate",
      member:     t.senator || t.member_name || t.name || "Unknown",
      ticker:     (t.ticker || t.asset_name || "").replace("$", "").toUpperCase().trim(),
      company:    t.asset_description || t.company || t.description || "",
      type:       t.type || t.transaction_type || "–",
      amount:     t.amount || t.transaction_amount || "–",
      date:       t.transaction_date || t.disclosure_date || t.filed_at || "",
      state:      t.state || "",
      party:      t.party || "",
      isWatchlist: WATCHLIST.includes((t.ticker || "").replace("$", "").toUpperCase().trim()),
    }));
  return { status: "live", trades };
}

// ── StockTwits sentiment ──────────────────────────────────────────────────────
async function fetchStockTwitsTrending() {
  const data = await safeFetch(ST_TRENDING);
  if (!data || !data.symbols) return { status: "unavailable", symbols: [] };
  return {
    status: "live",
    symbols: (data.symbols || []).slice(0, 20).map((s) => ({
      symbol:       s.symbol,
      title:        s.title,
      watchlist:    s.watchlist_count || 0,
      messages:     s.messages_count || s.message_count || 0,
      sentiment:    s.symbol_sentiment?.bull_minus_bear_score ?? null,
      bullPercent:  s.symbol_sentiment?.bull_percent ?? null,
      bearPercent:  s.symbol_sentiment?.bear_percent ?? null,
      price:        s.prices?.last?.close ?? null,
      change:       s.prices?.last?.change_percent ?? null,
      isWatchlist:  WATCHLIST.includes(s.symbol),
    })),
  };
}

// Sentiment for our specific watchlist tickers
async function fetchWatchlistSentiment() {
  const tickers = ["NVDA", "AMD", "PLTR", "META", "TSLA", "SPY", "QQQ"];
  const results = await Promise.allSettled(
    tickers.map(async (sym) => {
      const data = await safeFetch(ST_STREAM(sym));
      if (!data || !data.messages) return null;
      const msgs = data.messages || [];
      const bull = msgs.filter((m) => m.entities?.sentiment?.basic === "Bullish").length;
      const bear = msgs.filter((m) => m.entities?.sentiment?.basic === "Bearish").length;
      const total = bull + bear;
      return {
        symbol:     sym,
        bullCount:  bull,
        bearCount:  bear,
        bullPct:    total > 0 ? Math.round((bull / total) * 100) : 50,
        recentMsgs: msgs.slice(0, 3).map((m) => ({
          text:      m.body?.slice(0, 120) || "",
          sentiment: m.entities?.sentiment?.basic || "neutral",
          user:      m.user?.username || "",
          created:   m.created_at || "",
        })),
      };
    })
  );
  return results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value);
}

// ── Reddit social feeds ───────────────────────────────────────────────────────
const TICKER_REGEX = /\b([A-Z]{2,5})\b/g;
const KNOWN_TICKERS = new Set(WATCHLIST);

function extractTickers(text = "") {
  const matches = text.match(TICKER_REGEX) || [];
  return [...new Set(matches.filter((m) => KNOWN_TICKERS.has(m)))];
}

async function fetchRedditFeed(url, subreddit) {
  const data = await safeFetch(url, {
    headers: { "User-Agent": "Specularis:MarketTerminal:v7.0 (by /u/specularis_bot)" },
  });
  if (!data?.data?.children) return [];
  return data.data.children
    .filter((c) => c.kind === "t3" && !c.data.stickied)
    .map((c) => {
      const d = c.data;
      const text = `${d.title} ${d.selftext || ""}`.slice(0, 500);
      return {
        subreddit,
        title:   d.title?.slice(0, 140) || "",
        score:   d.score || 0,
        comments:d.num_comments || 0,
        url:     d.url || "",
        created: new Date((d.created_utc || 0) * 1000).toISOString(),
        tickers: extractTickers(text),
        flair:   d.link_flair_text || "",
      };
    })
    .filter((p) => p.score > 10);
}

async function fetchRedditSignals() {
  const [wsb, stocks, inv] = await Promise.all([
    fetchRedditFeed(REDDIT_WSB, "wallstreetbets"),
    fetchRedditFeed(REDDIT_STKS, "stocks"),
    fetchRedditFeed(REDDIT_INV, "investing"),
  ]);
  const all = [...wsb, ...stocks, ...inv]
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  // Ticker mention frequency across all reddit posts
  const freq = {};
  for (const p of all) {
    for (const t of p.tickers) {
      freq[t] = (freq[t] || 0) + 1 + Math.log1p(p.score / 100);
    }
  }
  const hot = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([symbol, score]) => ({ symbol, heat: Math.round(score * 10) / 10 }));

  return {
    status: all.length > 0 ? "live" : "unavailable",
    posts: all.slice(0, 20),
    hotTickers: hot,
  };
}

// ── Aggregate scoring: detect watchlist overlaps ──────────────────────────────
function buildIntelSummary({ houseTrades, senateTrades, trending, sentiment, reddit }) {
  const allTrades = [...(houseTrades.trades || []), ...(senateTrades.trades || [])];
  const watchlistTrades = allTrades.filter((t) => t.isWatchlist);

  // Count buys/sells per ticker among congress members
  const congressActivity = {};
  for (const t of allTrades) {
    const sym = t.ticker;
    if (!sym || sym.length > 5) continue;
    const k = sym.toUpperCase();
    if (!congressActivity[k]) congressActivity[k] = { buys: 0, sells: 0, members: new Set() };
    const isBuy = /pur|buy|acqui/i.test(t.type);
    if (isBuy) congressActivity[k].buys++;
    else congressActivity[k].sells++;
    congressActivity[k].members.add(t.member);
  }

  // Convert to array, sort by total activity
  const activityRank = Object.entries(congressActivity)
    .map(([sym, v]) => ({
      symbol:  sym,
      buys:    v.buys,
      sells:   v.sells,
      members: v.members.size,
      net:     v.buys - v.sells,
      isWatchlist: KNOWN_TICKERS.has(sym),
    }))
    .sort((a, b) => (b.buys + b.sells) - (a.buys + a.sells))
    .slice(0, 15);

  // Confluence: tickers active in congress AND trending on social
  const socialHot = new Set([
    ...(trending.symbols || []).map((s) => s.symbol),
    ...(reddit.hotTickers || []).map((h) => h.symbol),
  ]);
  const confluence = activityRank
    .filter((r) => socialHot.has(r.symbol))
    .map((r) => ({ ...r, confluenceSignal: true }));

  return {
    watchlistTrades: watchlistTrades.slice(0, 15),
    congressActivityRank: activityRank,
    confluence,
    totalCongressTrades: allTrades.length,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(_req, res) {
  const [houseTrades, senateTrades, trending, sentiment, reddit] = await Promise.all([
    fetchHouseTrades(),
    fetchSenateTrades(),
    fetchStockTwitsTrending(),
    fetchWatchlistSentiment(),
    fetchRedditSignals(),
  ]);

  const intel = buildIntelSummary({ houseTrades, senateTrades, trending, sentiment, reddit });

  const payload = {
    generatedAt: new Date().toISOString(),
    sources: {
      house:    houseTrades.status,
      senate:   senateTrades.status,
      stocktwits: trending.status,
      reddit:   reddit.status,
    },
    congress: {
      house:  houseTrades,
      senate: senateTrades,
    },
    social: {
      trending,
      sentiment,
      reddit,
    },
    intel,
  };

  json(res, 200, payload, 900); // cache 15 min
}
