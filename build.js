"use strict";
// 日の出日の入りカレンダー 静的サイトジェネレータ
// 生成物: docs/ 以下に index.html + 47県ハブ + 47×12月ページ + sitemap.xml + 404.html
const fs = require("fs");
const path = require("path");
const { dayTimes, hhmm, daysInMonth } = require("./lib/solar");
const { PREFS, REGIONS, NEIGHBORS } = require("./lib/prefectures");

const BASE = "https://claudetarouggl-coder.github.io/hinode-calendar/";
const GA_ID = "G-4K8SR10PRC";
const OUT = path.join(__dirname, "docs");

// ビルド時点のJST日付
const jstNow = new Date(Date.now() + 540 * 60000);
const TODAY = { y: jstNow.getUTCFullYear(), m: jstNow.getUTCMonth() + 1, d: jstNow.getUTCDate() };
const TODAY_STR = `${TODAY.y}-${String(TODAY.m).padStart(2, "0")}-${String(TODAY.d).padStart(2, "0")}`;

const SPECIAL = {
  "2026-1-1": "元日", "2026-3-20": "春分", "2026-6-21": "夏至", "2026-9-23": "秋分", "2026-12-22": "冬至",
  "2027-1-1": "元日", "2027-3-21": "春分", "2027-6-21": "夏至", "2027-9-23": "秋分", "2027-12-22": "冬至",
  "2028-1-1": "元日", "2028-3-20": "春分", "2028-6-21": "夏至", "2028-9-22": "秋分", "2028-12-21": "冬至",
};
const WDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const bySlug = Object.fromEntries(PREFS.map(p => [p.slug, p]));
const regionOf = Object.fromEntries(
  Object.entries(REGIONS).flatMap(([r, slugs]) => slugs.map(s => [s, r])));

// ---- 計算（全県×全年月をメモ化） ----
const monthCache = new Map();
function monthData(slug, y, m) {
  const key = `${slug}-${y}-${m}`;
  if (monthCache.has(key)) return monthCache.get(key);
  const p = bySlug[slug];
  const days = [];
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const t = dayTimes(y, m, d, p.lat, p.lng);
    days.push({ d, wday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), ...t, dayLen: t.sunset - t.sunrise });
  }
  const r = { y, m, days };
  monthCache.set(key, r);
  return r;
}
const minBy = (arr, f) => arr.reduce((a, b) => (f(b) < f(a) ? b : a));
const maxBy = (arr, f) => arr.reduce((a, b) => (f(b) > f(a) ? b : a));
const lenStr = min => `${Math.floor(Math.round(min) / 60)}時間${String(Math.round(min) % 60).padStart(2, "0")}分`;

// 月の主要年: その月の今年分がまだ終わっていなければ今年、過ぎていれば来年
const primaryYear = m => (m >= TODAY.m ? TODAY.y : TODAY.y + 1);
const referenceYear = py => py === TODAY.y ? py + 1 : py - 1;

// ---- HTMLヘルパー ----
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emittedUrls = [];
const linkTargets = new Set();
function canonical(p) {
  const u = BASE + p;
  if (!u.startsWith(BASE)) throw new Error(`BAD URL: ${u}`);
  return u;
}
// depth: ページの階層 (home=0, hub=1, month=2)。target: 正規パス("", "tokyo/", "tokyo/08/")
function rel(depth, target) {
  linkTargets.add(target);
  return target ? "../".repeat(depth) + target : (depth ? "../".repeat(depth) : "./");
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;color:#3a3226;background:#fdf9f2;line-height:1.7}
main{max-width:860px;margin:0 auto;padding:1rem}
header.site{background:linear-gradient(180deg,#8ec3ea,#ffe9c2);padding:1.2rem 1rem .8rem;text-align:center}
header.site a{color:#3a3226;text-decoration:none;font-weight:bold}
h1{font-size:1.35rem;margin:.8rem 0 .3rem}
h2{font-size:1.1rem;margin:1.6rem 0 .5rem;border-left:4px solid #e07b2f;padding-left:.5rem}
nav.bc{font-size:.8rem;color:#8a7d68;margin:.5rem 0}
nav.bc a{color:#a5642a}
.today-box{background:#fff;border:1px solid #eadfce;border-radius:10px;padding:1rem;margin:1rem 0;display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;text-align:center}
.today-box .f .lb{font-size:.72rem;color:#8a7d68;letter-spacing:.15em}
.today-box .f .vl{font-size:1.3rem}
.tbl{overflow-x:auto;background:#fff;border:1px solid #eadfce;border-radius:10px;margin:.8rem 0}
table{border-collapse:collapse;width:100%;font-size:.85rem;white-space:nowrap}
th,td{padding:.35rem .6rem;text-align:center;border-bottom:1px solid #f2ead9}
th{background:#faf3e6;font-weight:600}
tr.sat td:first-child{color:#2a6bb5}tr.sun td:first-child{color:#c33}
tr.today-row{background:#fff3dd}
.feature,.faq,.note{background:#fff;border:1px solid #eadfce;border-radius:10px;padding:1rem;margin:.8rem 0;font-size:.92rem}
.faq dt{font-weight:600;margin-top:.6rem}.faq dd{margin-left:0;color:#5a4f3c}
.mnav{display:flex;justify-content:space-between;margin:.8rem 0;font-size:.9rem}
.links{display:flex;flex-wrap:wrap;gap:.5rem;margin:.6rem 0}
.links a{background:#fff;border:1px solid #eadfce;border-radius:999px;padding:.3rem .8rem;font-size:.85rem;text-decoration:none;color:#a5642a}
a{color:#a5642a}
footer{margin:2rem 0 1rem;color:#8a7d68;font-size:.75rem;text-align:center;line-height:1.9}
.pref-table td{text-align:center}
`.trim();

function shell({ path: pagePath, depth, title, desc, h1, breadcrumbs, body, extraHead = "", extraScript = "" }) {
  const canon = canonical(pagePath);
  emittedUrls.push(canon);
  const bcJson = breadcrumbs.length ? `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((b, i) => ({
      "@type": "ListItem", position: i + 1, name: b.name,
      ...(b.path !== null ? { item: canonical(b.path) } : {}),
    })),
  })}</script>` : "";
  const bcNav = breadcrumbs.length > 1 ? `<nav class="bc">${breadcrumbs.map((b, i) =>
    i === breadcrumbs.length - 1 ? esc(b.name) : `<a href="${rel(depth, b.path)}">${esc(b.name)}</a>`).join(" › ")}</nav>` : "";
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>
${bcJson}${extraHead}
<style>${CSS}</style>
</head>
<body>
<header class="site"><a href="${rel(depth, "")}">日の出・日の入り時刻カレンダー</a></header>
<main>
${bcNav}
<h1>${h1}</h1>
${body}
<footer>
掲載時刻はNOAAの太陽位置計算式による理論値です（海抜0m・平坦な地平線を仮定、誤差±1分程度）。<br>
観測点は各都道府県庁所在地の緯度経度を使用しています。公的な値は<a href="https://eco.mtk.nao.ac.jp/koyomi/" rel="noopener">国立天文台 暦計算室</a>をご確認ください。
</footer>
</main>
${extraScript}
</body>
</html>`;
}

function writePage(relPath, html) {
  const file = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function dayRowsHtml(md, highlightToday) {
  const p = md.days;
  const rows = p.map((r, i) => {
    const prev = i > 0 ? p[i - 1].dayLen : null;
    const diff = prev === null ? "—" : (() => {
      const d10 = Math.round((r.dayLen - prev) * 10) / 10;
      return `${d10 >= 0 ? "+" : "−"}${Math.abs(d10).toFixed(1)}分`;
    })();
    const cls = [r.wday === 6 ? "sat" : r.wday === 0 ? "sun" : "",
      highlightToday && md.y === TODAY.y && md.m === TODAY.m && r.d === TODAY.d ? "today-row" : ""].join(" ").trim();
    const sp = SPECIAL[`${md.y}-${md.m}-${r.d}`];
    return `<tr data-date="${md.y}-${md.m}-${r.d}"${cls ? ` class="${cls}"` : ""}><td>${r.d}日(${WDAYS[r.wday]})${sp ? `<br><small>${sp}</small>` : ""}</td><td>${hhmm(r.dawn)}</td><td><strong>${hhmm(r.sunrise)}</strong></td><td>${hhmm(r.noon)}</td><td><strong>${hhmm(r.sunset)}</strong></td><td>${hhmm(r.dusk)}</td><td>${lenStr(r.dayLen)}</td><td>${diff}</td></tr>`;
  }).join("\n");
  return `<div class="tbl"><table>
<thead><tr><th>日付</th><th>薄明始</th><th>日の出</th><th>南中</th><th>日の入り</th><th>薄明終</th><th>昼の長さ</th><th>前日差</th></tr></thead>
<tbody>${rows}</tbody></table></div>`;
}

// ---- 月ページ ----
function buildMonthPage(p, m) {
  const py = primaryYear(m);
  const ry = referenceYear(py);
  const pm = monthData(p.slug, py, m);
  const rm = monthData(p.slug, ry, m);
  const earliestRise = minBy(pm.days, r => r.sunrise);
  const latestRise = maxBy(pm.days, r => r.sunrise);
  const earliestSet = minBy(pm.days, r => r.sunset);
  const latestSet = maxBy(pm.days, r => r.sunset);
  const first = pm.days[0], last = pm.days[pm.days.length - 1];
  const lenDiff = Math.round(last.dayLen - first.dayLen);
  const growing = lenDiff >= 0;
  const perDay = Math.abs(lenDiff / (pm.days.length - 1)).toFixed(1);
  const mid = pm.days[14];

  const sentences = [
    `${py}年${m}月の${p.city}で最も日の出が早いのは${m}月${earliestRise.d}日の${hhmm(earliestRise.sunrise)}、最も遅いのは${m}月${latestRise.d}日の${hhmm(latestRise.sunrise)}です。`,
    `日の入りは${m}月${earliestSet.d}日の${hhmm(earliestSet.sunset)}が最も早く、${m}月${latestSet.d}日の${hhmm(latestSet.sunset)}が最も遅くなります。`,
    `昼の長さは月初の${lenStr(first.dayLen)}から月末の${lenStr(last.dayLen)}へと、この1か月で約${Math.abs(lenDiff)}分${growing ? "長く" : "短く"}なります。`,
    `1日あたり平均で約${perDay}分ずつ${growing ? "日が長く" : "日が短く"}なっていく時期です。`,
  ];
  const specialDay = pm.days.find(r => SPECIAL[`${py}-${m}-${r.d}`]);
  if (specialDay) {
    const name = SPECIAL[`${py}-${m}-${specialDay.d}`];
    sentences.push(`${m}月${specialDay.d}日は${name}で、${p.city}の日の出は${hhmm(specialDay.sunrise)}、日の入りは${hhmm(specialDay.sunset)}です。`);
  }
  if (p.slug !== "tokyo") {
    const tokyoMid = monthData("tokyo", py, m).days[14];
    const dmin = Math.round(mid.sunrise - tokyoMid.sunrise);
    if (dmin !== 0) sentences.push(`${m}月中旬の日の出は東京より約${Math.abs(dmin)}分${dmin < 0 ? "早い" : "遅い"}時刻です。`);
  }

  const prevM = m === 1 ? 12 : m - 1, nextM = m === 12 ? 1 : m + 1;
  const mm = String(m).padStart(2, "0");
  const neighborLinks = NEIGHBORS[p.slug].map(s =>
    `<a href="${rel(2, `${s}/${mm}/`)}">${bySlug[s].pref}の${m}月</a>`).join("");

  const body = `
<div class="mnav"><a href="${rel(2, `${p.slug}/${String(prevM).padStart(2, "0")}/`)}">← ${prevM}月</a><a href="${rel(2, `${p.slug}/`)}">${esc(p.pref)}の月別一覧</a><a href="${rel(2, `${p.slug}/${String(nextM).padStart(2, "0")}/`)}">${nextM}月 →</a></div>
<section class="feature"><h2>この月の特徴</h2><p>${sentences.join("")}</p></section>
<h2>${py}年${m}月の日別データ（${esc(p.city)}）</h2>
${dayRowsHtml(pm, true)}
<h2>参考：${ry}年${m}月</h2>
${dayRowsHtml(rm, false)}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>${m}月の${esc(p.pref)}で最も日の出が早いのはいつですか？</dt><dd>${py}年${m}月${earliestRise.d}日の${hhmm(earliestRise.sunrise)}です（${esc(p.city)}）。</dd>
<dt>${m}月の${esc(p.pref)}の昼の長さはどのくらいですか？</dt><dd>月初は${lenStr(first.dayLen)}、月末は${lenStr(last.dayLen)}で、約${Math.abs(lenDiff)}分${growing ? "長く" : "短く"}なります。</dd>
<dt>${esc(p.pref)}の${m}月の南中時刻は何時ごろですか？</dt><dd>おおよそ${hhmm(minBy(pm.days, r => r.noon).noon)}〜${hhmm(maxBy(pm.days, r => r.noon).noon)}の範囲です。</dd>
</dl></section>
<h2>近隣県の${m}月</h2><div class="links">${neighborLinks}</div>`;

  writePage(`${p.slug}/${mm}/index.html`, shell({
    path: `${p.slug}/${mm}/`, depth: 2,
    title: `${p.pref}の日の出・日の入り ${py}年${m}月｜日ごとの時刻一覧`,
    desc: `${py}年${m}月の${p.city}の日の出・日の入り時刻を1日ごとに一覧掲載。最も早い日の出は${m}月${earliestRise.d}日の${hhmm(earliestRise.sunrise)}、最も遅い日の入りは${m}月${latestSet.d}日の${hhmm(latestSet.sunset)}。この1か月で昼の長さは約${Math.abs(lenDiff)}分${growing ? "長く" : "短く"}なります。`,
    h1: `${p.pref}の日の出・日の入り時刻 ${py}年${m}月`,
    breadcrumbs: [{ name: "ホーム", path: "" }, { name: p.pref, path: `${p.slug}/` }, { name: `${m}月`, path: `${p.slug}/${mm}/` }],
    body,
    extraScript: `<script>(function(){var n=new Date(Date.now()+540*60000);var c=n.getUTCFullYear()+"-"+(n.getUTCMonth()+1)+"-"+n.getUTCDate();document.querySelectorAll("tr[data-date]").forEach(function(tr){tr.classList.toggle("today-row",tr.getAttribute("data-date")===c);});})();</script>`,
  }));
}

// ---- クライアント側で「今日」ブロックを最新化するスクリプト ----
const clientLib = fs.readFileSync(path.join(__dirname, "lib", "solar.js"), "utf8")
  .split("// <client>")[1].split("// </client>")[0];
function refreshScript(prefsJson) {
  return `<script>
${clientLib}
(function(){
  var PREFS=${prefsJson};
  var baked="${TODAY_STR}";
  var now=new Date(Date.now()+540*60000);
  var y=now.getUTCFullYear(),m=now.getUTCMonth()+1,d=now.getUTCDate();
  var cur=y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  if(cur===baked)return;
  document.querySelectorAll("[data-today-date]").forEach(function(el){el.textContent=y+"年"+m+"月"+d+"日";});
  PREFS.forEach(function(p){
    var t=dayTimes(y,m,d,p.lat,p.lng);
    ["sunrise","noon","sunset"].forEach(function(k){
      var el=document.querySelector('[data-t="'+p.slug+'-'+k+'"]');
      if(el)el.textContent=hhmm(t[k]);
    });
    var dl=document.querySelector('[data-t="'+p.slug+'-daylen"]');
    if(dl){var L=Math.round(t.sunset-t.sunrise);dl.textContent=Math.floor(L/60)+"時間"+String(L%60).padStart(2,"0")+"分";}
  });
})();
</script>`;
}

// ---- 県ハブページ ----
function buildHubPage(p) {
  const t = dayTimes(TODAY.y, TODAY.m, TODAY.d, p.lat, p.lng);
  const curMonth = monthData(p.slug, TODAY.y, TODAY.m);
  const mrEarly = minBy(curMonth.days, r => r.sunrise), mrLate = maxBy(curMonth.days, r => r.sunrise);
  const msEarly = minBy(curMonth.days, r => r.sunset), msLate = maxBy(curMonth.days, r => r.sunset);
  const monthLinks = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1, mm = String(m).padStart(2, "0");
    const py = primaryYear(m);
    const d1 = monthData(p.slug, py, m).days[0];
    return `<a href="${rel(1, `${p.slug}/${mm}/`)}">${m}月<small>（1日 ${hhmm(d1.sunrise)}）</small></a>`;
  }).join("");
  const region = regionOf[p.slug];
  const regionLinks = REGIONS[region].filter(s => s !== p.slug).map(s =>
    `<a href="${rel(1, `${s}/`)}">${bySlug[s].pref}</a>`).join("");
  const dayLen = Math.round(t.sunset - t.sunrise);

  const body = `
<div class="today-box">
<div class="f"><div class="lb">きょう <span data-today-date>${TODAY.y}年${TODAY.m}月${TODAY.d}日</span></div></div>
<div class="f"><div class="lb">日の出</div><div class="vl" data-t="${p.slug}-sunrise">${hhmm(t.sunrise)}</div></div>
<div class="f"><div class="lb">南中</div><div class="vl" data-t="${p.slug}-noon">${hhmm(t.noon)}</div></div>
<div class="f"><div class="lb">日の入り</div><div class="vl" data-t="${p.slug}-sunset">${hhmm(t.sunset)}</div></div>
<div class="f"><div class="lb">昼の長さ</div><div class="vl" data-t="${p.slug}-daylen">${lenStr(dayLen)}</div></div>
</div>
<p>観測点は${esc(p.city)}（${esc(p.pref)}庁所在地）です。月別カレンダーで毎日の日の出・日の入り・南中時刻・市民薄明・昼の長さを確認できます。</p>
<h2>月別カレンダー</h2><div class="links">${monthLinks}</div>
<h2>${esc(region)}の他の都道府県</h2><div class="links">${regionLinks}</div>`;

  writePage(`${p.slug}/index.html`, shell({
    path: `${p.slug}/`, depth: 1,
    title: `${p.pref}の日の出・日の入り時刻｜月別カレンダー`,
    desc: `${TODAY.m}月の${p.city}の日の出は${hhmm(mrEarly.sunrise)}〜${hhmm(mrLate.sunrise)}、日の入りは${hhmm(msEarly.sunset)}〜${hhmm(msLate.sunset)}。南中時刻・昼の長さもあわせて掲載。1月〜12月の月別カレンダーから毎日の時刻を確認できます。`,
    h1: `${p.pref}の日の出・日の入り時刻`,
    breadcrumbs: [{ name: "ホーム", path: "" }, { name: p.pref, path: `${p.slug}/` }],
    body,
    extraScript: refreshScript(JSON.stringify([{ slug: p.slug, lat: p.lat, lng: p.lng }])),
  }));
}

// ---- トップページ ----
function buildHome() {
  const sections = Object.entries(REGIONS).map(([region, slugs]) => {
    const rows = slugs.map(s => {
      const p = bySlug[s];
      const t = dayTimes(TODAY.y, TODAY.m, TODAY.d, p.lat, p.lng);
      const L = Math.round(t.sunset - t.sunrise);
      return `<tr><td><a href="${rel(0, `${s}/`)}">${esc(p.pref)}</a><small>（${esc(p.city)}）</small></td><td data-t="${s}-sunrise"><strong>${hhmm(t.sunrise)}</strong></td><td data-t="${s}-noon">${hhmm(t.noon)}</td><td data-t="${s}-sunset"><strong>${hhmm(t.sunset)}</strong></td><td data-t="${s}-daylen">${lenStr(L)}</td></tr>`;
    }).join("\n");
    return `<h2>${esc(region)}</h2><div class="tbl"><table class="pref-table">
<thead><tr><th>都道府県</th><th>日の出</th><th>南中</th><th>日の入り</th><th>昼の長さ</th></tr></thead>
<tbody>${rows}</tbody></table></div>`;
  }).join("\n");

  const websiteJson = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "WebSite",
    name: "日の出・日の入り時刻カレンダー", url: BASE,
  })}</script>`;

  writePage("index.html", shell({
    path: "", depth: 0,
    title: "日の出・日の入り時刻カレンダー｜全国47都道府県",
    desc: "全国47都道府県の今日の日の出・日の入り・南中時刻・昼の長さを一覧で確認。都道府県別に毎月の日別カレンダーを掲載しています。",
    h1: `全国の日の出・日の入り時刻（<span data-today-date>${TODAY.y}年${TODAY.m}月${TODAY.d}日</span>）`,
    breadcrumbs: [],
    body: sections,
    extraHead: websiteJson,
    extraScript: refreshScript(JSON.stringify(PREFS.map(p => ({ slug: p.slug, lat: p.lat, lng: p.lng })))),
  }));
}

// ---- 404 / sitemap ----
function build404() {
  writePage("404.html", `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>ページが見つかりません</title><style>${CSS}</style></head>
<body><main style="text-align:center;padding-top:3rem"><h1>ページが見つかりません</h1><p><a href="${BASE}">日の出・日の入り時刻カレンダー トップへ</a></p></main></body></html>`);
}
function buildSitemap() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${emittedUrls.map(u => `  <url><loc>${u}</loc><lastmod>${TODAY_STR}</lastmod></url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), xml);
}

// ---- 実行 ----
fs.rmSync(OUT, { recursive: true, force: true });
for (const p of PREFS) {
  buildHubPage(p);
  for (let m = 1; m <= 12; m++) buildMonthPage(p, m);
}
buildHome();
build404();
buildSitemap();
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

// 整合性チェック: リンク先の実在・ページ数・URLプレフィックス
for (const t of linkTargets) {
  const f = path.join(OUT, t, "index.html");
  if (!fs.existsSync(f)) throw new Error(`BROKEN LINK TARGET: ${t}`);
}
const expected = 1 + 47 + 47 * 12;
if (emittedUrls.length !== expected) throw new Error(`page count ${emittedUrls.length} != ${expected}`);
if (!emittedUrls.every(u => u.startsWith(BASE))) throw new Error("URL outside BASE");
console.log(`OK: ${emittedUrls.length} pages + 404 + sitemap generated for ${TODAY_STR}`);
