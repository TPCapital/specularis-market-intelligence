import { fetchJson, json } from "../lib/utils.js";

const symbols = [
  "NASDAQ:NVDA",
  "NASDAQ:AMD",
  "NASDAQ:AVGO",
  "NASDAQ:MRVL",
  "NASDAQ:MSFT",
  "NASDAQ:AMZN",
  "NASDAQ:META",
  "NASDAQ:TSLA",
  "NASDAQ:PLTR",
  "NYSE:ORCL",
  "NASDAQ:CRWD",
  "NASDAQ:COIN"
];

const sectorMap = {
  NVDA: "AI 半导体",
  AMD: "AI 半导体",
  AVGO: "AI 半导体",
  MRVL: "AI 半导体",
  MSFT: "大型科技",
  AMZN: "大型科技",
  META: "大型科技",
  TSLA: "动量科技",
  PLTR: "AI 软件",
  ORCL: "AI 软件",
  CRWD: "网络安全",
  COIN: "加密资产"
};

export default async function handler(_req, res) {
  try {
    const payload = await fetchJson("https://scanner.tradingview.com/america/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbols: { tickers: symbols, query: { types: [] } },
        columns: ["name", "close", "change", "volume", "Recommend.All", "RSI"],
        range: [0, 50]
      })
    });

    const rows = (payload.data || [])
      .map((row) => {
        const [symbol, close, change, volume, recommendation, rsi] = row.d || [];
        const score = Math.max(0, Math.min(100, Math.round(55 + (change || 0) * 4 + (recommendation || 0) * 18 + ((rsi || 50) - 50) * 0.35)));
        return {
          symbol,
          score,
          sector: sectorMap[symbol] || "强势股",
          logic: `TradingView 动量 ${Number(change || 0).toFixed(2)}%，RSI ${Number(rsi || 0).toFixed(1)}，量能 ${Number(volume || 0).toLocaleString("en-US")}。`
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    json(res, 200, rows, 60);
  } catch (error) {
    json(res, 502, { error: "TradingView upstream unavailable", detail: error.message }, 10);
  }
}
