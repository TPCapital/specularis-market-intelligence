// modules/news-radar.js — Horizon-style themed news radar
// Handles the Tab 1 news radar section independent of Intelligence OS

const NEWS_THEMES = [
  { key:"ai_semi",  label:"AI / 半导体", icon:"🔵", keywords:/\b(AI|nvidia|amd|gpu|semiconductor|chip|TSM|ASML|Broadcom|Marvell|NVDA)\b/i },
  { key:"macro",    label:"宏观 / 利率", icon:"🔴", keywords:/\b(fed|rate|yield|inflation|CPI|PCE|powell|FOMC|treasury|bond)\b/i },
  { key:"cloud",    label:"云计算 / 软件",icon:"🟢", keywords:/\b(cloud|SaaS|microsoft|amazon|google|azure|AWS|oracle|MSFT|AMZN|GOOGL)\b/i },
  { key:"crypto",   label:"加密 / 风险", icon:"🟡", keywords:/\b(bitcoin|crypto|ETH|coinbase|microstrategy|BTC|COIN|MSTR)\b/i },
  { key:"geopolit", label:"地缘 / 政策", icon:"🟣", keywords:/\b(tariff|sanction|china|trade|congress|regulation|export|ban)\b/i },
];

function scoreImportance(item) {
  const text = `${item.title||""} ${item.summary||""}`;
  let s = 5;
  if (/\bEARNING|BEAT|MISS|GUIDANCE|UPGRADE|DOWNGRADE\b/i.test(text)) s += 4;
  if (/\bFED|FOMC|RATE|INFLATION|GDP\b/i.test(text)) s += 3;
  if (/\bNVDA|AMD|MSFT|AAPL|META|GOOGL|AMZN|TSLA\b/i.test(text)) s += 2;
  const ageMins = item.datetime ? Math.floor((Date.now()-item.datetime)/60000) : 999;
  if (ageMins<30) s+=3; else if (ageMins<120) s+=1;
  return Math.min(s,10);
}

function categorize(items=[]) {
  const buckets = {};
  NEWS_THEMES.forEach(t=>{ buckets[t.key]={...t,items:[]}; });
  for (const item of items) {
    const text = `${item.title||""} ${item.summary||""}`;
    for (const theme of NEWS_THEMES) {
      if (theme.keywords.test(text)) { buckets[theme.key].items.push(item); break; }
    }
  }
  return buckets;
}

function renderRadar(snapshot) {
  const newsItems = [
    ...(snapshot?.sources?.newsCatalysts?.data?.news||[]),
    ...(snapshot?.terminalLite?.newsFeed||[]),
    ...(snapshot?.news||[]),
  ].slice(0,60);

  const buckets = categorize(newsItems);
  const active = Object.values(buckets).filter(b=>b.items.length>0);
  if (!active.length) return `<p style="color:#475569;font-size:0.8rem;padding:16px">新闻雷达等待数据...</p>`;

  return active.map(theme=>{
    const top = [...theme.items].sort((a,b)=>scoreImportance(b)-scoreImportance(a)).slice(0,4);
    const itemsHtml = top.map(item=>{
      const imp = scoreImportance(item);
      const cls = imp>=8?"score-high":imp>=5?"score-mid":"score-low";
      const title = (item.title||item.headline||"").slice(0,90);
      return `<div class="news-radar-item">
        <span class="news-radar-score ${cls}">${imp}</span>${title}
      </div>`;
    }).join("");
    return `<div class="news-radar-bucket">
      <div class="news-radar-bucket-header">
        <span class="news-radar-bucket-title">${theme.icon} ${theme.label}</span>
        <span class="news-radar-count">${theme.items.length}条</span>
      </div>${itemsHtml}
    </div>`;
  }).join("");
}

// Listen for snapshot data and update the radar
window.addEventListener("specularis-snapshot", (e) => {
  const el = document.getElementById("newsRadarGrid");
  if (!el) return;
  el.innerHTML = renderRadar(e.detail||{});
  el.classList.remove("is-loading");
  const meta = document.getElementById("newsRadarMeta");
  if (meta) meta.textContent = `Horizon · ${Object.values(categorize([
    ...(e.detail?.sources?.newsCatalysts?.data?.news||[]),
    ...(e.detail?.terminalLite?.newsFeed||[]),
    ...(e.detail?.news||[]),
  ])).filter(b=>b.items?.length>0).length}个主题`;
});
