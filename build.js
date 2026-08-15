"use strict";
// 日の出日の入りカレンダー 静的サイトジェネレータ
// 生成物: docs/ 以下に index.html + 47県ハブ + 47×12月ページ + sitemap.xml + 404.html
const fs = require("fs");
const path = require("path");
const { dayTimes, hhmm, daysInMonth, solarBasis } = require("./lib/solar");
const { PREFS, REGIONS, NEIGHBORS } = require("./lib/prefectures");
const AFFILIATES = require("./lib/affiliates");
let SPOTS = [];
try { SPOTS = require("./lib/spots"); }
catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; /* 名所データ未作成のときだけスキップ */ }

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
// 次の元日の年（元日当日のみ当年、翌日以降は来年分に切替）
const HATSU_YEAR = TODAY.m === 1 && TODAY.d === 1 ? TODAY.y : TODAY.y + 1;
const HATSU = `hatsuhinode/${HATSU_YEAR}/`;

// 次に来る冬至・夏至（エバーグリーンURL /toji/ /geshi/ の主要年）
// 日付は太陽赤緯の極値（=至点）をJSTで探して決める。テーブル不要で何年でも動く
function solsticeDate(y, kind) {
  const m = kind === "toji" ? 12 : 6;
  let best = null;
  for (let d = 17; d <= 25; d++) {
    for (let min = 0; min < 1440; min += 10) {
      const jd = (Date.UTC(y, m - 1, d) + (min - 540) * 60000) / 86400000 + 2440587.5;
      const { decl } = solarBasis(jd);
      if (!best || (kind === "toji" ? decl < best.decl : decl > best.decl)) best = { d, decl };
    }
  }
  return { y, m, d: best.d };
}
function nextSolstice(kind) {
  const cur = solsticeDate(TODAY.y, kind);
  if (cur.m > TODAY.m || (cur.m === TODAY.m && cur.d >= TODAY.d)) return cur;
  return solsticeDate(TODAY.y + 1, kind);
}
const TOJI = nextSolstice("toji");
const GESHI = nextSolstice("geshi");

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
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌅</text></svg>">
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
${m === 1 ? `<p><a href="${rel(2, `${HATSU}${p.slug}/`)}">→ ${esc(p.pref)}の初日の出${HATSU_YEAR}年（時刻・薄明・全国ランキング）</a></p>` : ""}
${m === 12 ? `<p><a href="${rel(2, "toji/")}">→ 冬至${TOJI.y}年の日の出・日の入り 全国一覧</a></p>` : ""}
${m === 6 ? `<p><a href="${rel(2, "geshi/")}">→ 夏至${GESHI.y}年の日の出・日の入り 全国一覧</a></p>` : ""}
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
  const hatsuLink = `<a href="${rel(1, `${HATSU}${p.slug}/`)}">🌅 初日の出${HATSU_YEAR}</a>`;
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
<h2>月別カレンダー</h2><div class="links">${monthLinks}${hatsuLink}</div>
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

// ---- 初日の出ページ群 ----
function affiliateBlock() {
  if (!AFFILIATES.goods.length) return "";
  const items = AFFILIATES.goods.map(g =>
    `<li><a href="${esc(g.url)}" rel="sponsored noopener" target="_blank">${esc(g.label)}</a>${g.note ? ` — ${esc(g.note)}` : ""}</li>`).join("\n");
  return `<section class="note"><h2>初日の出の持ち物・準備<small>（広告を含みます）</small></h2><ul style="margin-left:1.2em">${items}</ul></section>`;
}

function hatsuData() {
  return PREFS.map(p => {
    const t = dayTimes(HATSU_YEAR, 1, 1, p.lat, p.lng);
    return { ...p, t };
  }).sort((a, b) => a.t.sunrise - b.t.sunrise);
}

function buildHatsuIndex(ranked) {
  const first = ranked[0], last = ranked[ranked.length - 1];
  const rows = ranked.map((p, i) =>
    `<tr><td>${i + 1}</td><td><a href="${rel(2, `${HATSU}${p.slug}/`)}">${esc(p.pref)}</a><small>（${esc(p.city)}）</small></td><td><strong>${hhmm(p.t.sunrise)}</strong></td><td>${hhmm(p.t.dawn)}</td><td>${hhmm(p.t.sunset)}</td></tr>`).join("\n");
  const spread = Math.round(last.t.sunrise - first.t.sunrise);
  const body = `
<section class="feature"><p>${HATSU_YEAR}年の元日、47都道府県（県庁所在地基準）で最も早く初日の出を迎えるのは${first.pref}（${first.city}）の${hhmm(first.t.sunrise)}、最も遅いのは${last.pref}（${last.city}）の${hhmm(last.t.sunrise)}で、全国で約${spread}分の差があります。空が白み始める市民薄明はどの地域も日の出の約30分前からです。場所取りは薄明開始前の到着がおすすめです。</p></section>
${affiliateBlock()}
${SPOTS.length ? `<p><a href="${rel(2, `${HATSU}meisho/`)}">全国の初日の出名所${SPOTS.length}選の時刻一覧はこちら</a></p>` : ""}
<h2>都道府県別 初日の出時刻ランキング</h2>
<div class="tbl"><table><thead><tr><th>#</th><th>都道府県</th><th>初日の出</th><th>薄明開始</th><th>元日の日の入り</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  writePage(`${HATSU}index.html`, shell({
    path: HATSU, depth: 2,
    title: `初日の出${HATSU_YEAR} 全国47都道府県の時刻一覧｜何時に見える？`,
    desc: `${HATSU_YEAR}年元日の初日の出時刻を全国47都道府県で一覧比較。最も早いのは${first.pref}の${hhmm(first.t.sunrise)}、最も遅いのは${last.pref}の${hhmm(last.t.sunrise)}。薄明開始時刻と元日の日の入りもあわせて掲載しています。`,
    h1: `初日の出${HATSU_YEAR}年 全国の時刻一覧`,
    breadcrumbs: [{ name: "ホーム", path: "" }, { name: `初日の出${HATSU_YEAR}`, path: HATSU }],
    body,
  }));
}

function buildHatsuPref(p, rank, ranked) {
  const t = p.t;
  const tokyo = ranked.find(r => r.slug === "tokyo");
  const dTokyo = Math.round(t.sunrise - tokyo.t.sunrise);
  const sentences = [
    `${HATSU_YEAR}年1月1日、${p.pref}（${p.city}）の初日の出は${hhmm(t.sunrise)}ごろです。`,
    `全国47都道府県では${rank}番目の早さで、${p.slug === "tokyo" ? "" : `東京より約${Math.abs(dTokyo)}分${dTokyo < 0 ? "早い" : "遅い"}時刻です。`}`,
    `空が白み始める市民薄明は${hhmm(t.dawn)}ごろから。場所取りをするならこの時刻までの到着がおすすめです。`,
    `元日の日の入りは${hhmm(t.sunset)}、昼の長さは${lenStr(t.sunset - t.sunrise)}です。`,
  ];
  const neighborLinks = NEIGHBORS[p.slug].map(s =>
    `<a href="${rel(3, `${HATSU}${s}/`)}">${bySlug[s].pref}の初日の出</a>`).join("");
  const body = `
<div class="today-box">
<div class="f"><div class="lb">薄明開始</div><div class="vl">${hhmm(t.dawn)}</div></div>
<div class="f"><div class="lb">初日の出</div><div class="vl">${hhmm(t.sunrise)}</div></div>
<div class="f"><div class="lb">南中</div><div class="vl">${hhmm(t.noon)}</div></div>
<div class="f"><div class="lb">日の入り</div><div class="vl">${hhmm(t.sunset)}</div></div>
</div>
<section class="feature"><p>${sentences.join("")}</p></section>
${affiliateBlock()}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>${esc(p.pref)}の初日の出は何時ですか？</dt><dd>${HATSU_YEAR}年1月1日の${hhmm(t.sunrise)}ごろです（${esc(p.city)}・海抜0m基準の理論値）。山頂や高台では数分早く、建物や山に遮られる場所では遅くなります。</dd>
<dt>何時までに観賞場所に着けばいいですか？</dt><dd>空が白み始める${hhmm(t.dawn)}（市民薄明開始）までの到着がおすすめです。人気スポットはさらに早めに。</dd>
<dt>時刻は場所によって変わりますか？</dt><dd>同じ県内でも東側の海岸や高い場所ほど早くなります。掲載時刻は${esc(p.city)}基準です。</dd>
</dl></section>
<h2>あわせて見る</h2>
<div class="links"><a href="${rel(3, HATSU)}">全国の初日の出ランキング</a>${SPOTS.length ? `<a href="${rel(3, `${HATSU}meisho/`)}">初日の出の名所${SPOTS.length}選</a>` : ""}<a href="${rel(3, `${p.slug}/01/`)}">${esc(p.pref)}の1月の日の出カレンダー</a></div>
<h2>近隣県の初日の出</h2><div class="links">${neighborLinks}</div>`;
  writePage(`${HATSU}${p.slug}/index.html`, shell({
    path: `${HATSU}${p.slug}/`, depth: 3,
    title: `【${HATSU_YEAR}年】${p.pref}の初日の出は${hhmm(t.sunrise)}｜元日の日の出時刻`,
    desc: `${HATSU_YEAR}年1月1日、${p.pref}（${p.city}）の初日の出時刻は${hhmm(t.sunrise)}ごろ。薄明開始は${hhmm(t.dawn)}、日の入りは${hhmm(t.sunset)}。全国ランキングや近隣県の時刻、1月の日別カレンダーもあわせて掲載しています。`,
    h1: `${p.pref}の初日の出 ${HATSU_YEAR}年`,
    breadcrumbs: [{ name: "ホーム", path: "" }, { name: `初日の出${HATSU_YEAR}`, path: HATSU }, { name: p.pref, path: `${HATSU}${p.slug}/` }],
    body,
  }));
}

function buildMeisho() {
  if (!SPOTS.length) return;
  const spots = SPOTS.map(s => ({ ...s, t: dayTimes(HATSU_YEAR, 1, 1, s.lat, s.lng, s.elev) }))
    .sort((a, b) => a.t.sunrise - b.t.sunrise);
  const rows = spots.map((s, i) =>
    `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.pref)}</td><td>${s.elev}m</td><td><strong>${hhmm(s.t.sunrise)}</strong></td><td>${esc(s.note || "")}</td></tr>`).join("\n");
  const first = spots[0];
  const body = `
<section class="feature"><p>全国の初日の出名所${spots.length}か所について、${HATSU_YEAR}年元日の日の出時刻を標高補正つきで計算しました。最も早いのは${first.name}（${first.pref}・標高${first.elev}m）の${hhmm(first.t.sunrise)}です。標高が高いほど地平線が下がって見えるため、平地より数分早く初日の出を迎えます。</p></section>
${affiliateBlock()}
<h2>名所別 初日の出時刻（早い順）</h2>
<div class="tbl"><table><thead><tr><th>#</th><th>名所</th><th>都道府県</th><th>標高</th><th>初日の出</th><th>メモ</th></tr></thead><tbody>${rows}</tbody></table></div>
<section class="note">時刻は各地点の緯度経度・標高から計算した理論値です。実際には水平線の雲や周囲の地形の影響を受けます。標高補正は開けた地平線を仮定しています。</section>
<p><a href="${rel(3, HATSU)}">都道府県別の初日の出時刻一覧はこちら</a></p>`;
  writePage(`${HATSU}meisho/index.html`, shell({
    path: `${HATSU}meisho/`, depth: 3,
    title: `初日の出${HATSU_YEAR} 名所${spots.length}選の時刻一覧｜標高補正つき`,
    desc: `${HATSU_YEAR}年元日、犬吠埼・高尾山・富士山頂など全国の初日の出名所${spots.length}か所の日の出時刻を標高補正つきで一覧掲載。最も早いのは${first.name}の${hhmm(first.t.sunrise)}です。`,
    h1: `初日の出の名所${spots.length}選 ${HATSU_YEAR}年の時刻一覧`,
    breadcrumbs: [{ name: "ホーム", path: "" }, { name: `初日の出${HATSU_YEAR}`, path: HATSU }, { name: "名所一覧", path: `${HATSU}meisho/` }],
    body,
  }));
}

// ---- 冬至・夏至ページ（エバーグリーンURL、主要年は次の該当日） ----
function buildSolstice(kind) {
  const s = kind === "toji" ? TOJI : GESHI;
  const name = kind === "toji" ? "冬至" : "夏至";
  const rows47 = PREFS.map(p => {
    const t = dayTimes(s.y, s.m, s.d, p.lat, p.lng);
    return { ...p, t, len: t.sunset - t.sunrise };
  });
  // 冬至=昼が短い順、夏至=昼が長い順（そのページの主役の並び）
  const sorted = [...rows47].sort((a, b) => kind === "toji" ? a.len - b.len : b.len - a.len);
  const ext = sorted[0], opp = sorted[sorted.length - 1];
  const tokyo = rows47.find(r => r.slug === "tokyo");
  // 対になる至点の東京の昼の長さ（比較文用）
  const other = kind === "toji" ? GESHI : TOJI;
  const tokyoOther = dayTimes(other.y, other.m, other.d, tokyo.lat, tokyo.lng);
  const diffLen = Math.abs((tokyoOther.sunset - tokyoOther.sunrise) - tokyo.len);

  const rows = sorted.map((p, i) =>
    `<tr><td>${i + 1}</td><td><a href="${rel(1, `${p.slug}/`)}">${esc(p.pref)}</a><small>（${esc(p.city)}）</small></td><td><strong>${hhmm(p.t.sunrise)}</strong></td><td>${hhmm(p.t.noon)}</td><td><strong>${hhmm(p.t.sunset)}</strong></td><td>${lenStr(p.len)}</td></tr>`).join("\n");

  const intro = kind === "toji"
    ? `${s.y}年の冬至は${s.m}月${s.d}日です。一年で昼が最も短い日で、東京の昼の長さは${lenStr(tokyo.len)}。夏至と比べると約${lenStr(diffLen)}も短くなります。全国で最も昼が短いのは${ext.pref}（${ext.city}）の${lenStr(ext.len)}、最も長いのは${opp.pref}（${opp.city}）の${lenStr(opp.len)}で、緯度が高い（北にある）ほど冬の昼は短くなります。`
    : `${s.y}年の夏至は${s.m}月${s.d}日です。一年で昼が最も長い日で、東京の昼の長さは${lenStr(tokyo.len)}。冬至と比べると約${lenStr(diffLen)}も長くなります。全国で最も昼が長いのは${ext.pref}（${ext.city}）の${lenStr(ext.len)}、最も短いのは${opp.pref}（${opp.city}）の${lenStr(opp.len)}で、緯度が高い（北にある）ほど夏の昼は長くなります。`;

  const faq = kind === "toji" ? `
<dt>${s.y}年の冬至はいつですか？</dt><dd>${s.y}年${s.m}月${s.d}日です。翌年以降は12月21日または22日になります（年によって変わります）。</dd>
<dt>冬至は日の出が最も遅く、日の入りが最も早い日ですか？</dt><dd>いいえ。日の入りが最も早いのは冬至より2週間ほど前、日の出が最も遅いのは年明けの1月上旬です。詳しくは<a href="${rel(1, "column/earliest-sunset/")}">解説記事</a>をご覧ください。</dd>
<dt>冬至の昼はどのくらい短いのですか？</dt><dd>東京では${lenStr(tokyo.len)}です。夏至より約${lenStr(diffLen)}短く、これが一年の最小値です。</dd>` : `
<dt>${s.y}年の夏至はいつですか？</dt><dd>${s.y}年${s.m}月${s.d}日です。毎年6月21日ごろになります。</dd>
<dt>夏至は日の出が最も早い日ですか？</dt><dd>厳密には日の出が最も早いのは夏至より1週間ほど前、日の入りが最も遅いのは夏至の1週間ほど後です。均時差（南中時刻のずれ）が原因で、<a href="${rel(1, "column/earliest-sunset/")}">冬の「日の入りが最も早い日」のずれ</a>と同じ仕組みです。</dd>
<dt>夏至の昼はどのくらい長いのですか？</dt><dd>東京では${lenStr(tokyo.len)}です。冬至より約${lenStr(diffLen)}長く、これが一年の最大値です。</dd>`;

  const tojiGoods = kind === "toji" && (AFFILIATES.toji || []).length ? `<section class="note"><h2>冬至の過ごし方の定番<small>（広告を含みます）</small></h2><ul style="margin-left:1.2em">${
    AFFILIATES.toji.map(g => `<li><a href="${esc(g.url)}" rel="sponsored noopener" target="_blank">${esc(g.label)}</a> — ${esc(g.note)}</li>`).join("\n")
  }</ul></section>` : "";
  const mm2 = String(s.m).padStart(2, "0");
  const body = `
<section class="feature"><p>${intro}</p></section>
${tojiGoods}
<h2>${name}${s.y}年 全国47都道府県の日の出・日の入り（昼が${kind === "toji" ? "短" : "長"}い順）</h2>
<div class="tbl"><table><thead><tr><th>#</th><th>都道府県</th><th>日の出</th><th>南中</th><th>日の入り</th><th>昼の長さ</th></tr></thead><tbody>${rows}</tbody></table></div>
<section class="faq"><h2>よくある質問</h2><dl>${faq}</dl></section>
<h2>あわせて見る</h2>
<div class="links">${kind === "toji" ? `<a href="${rel(1, HATSU)}">初日の出${HATSU_YEAR}年 全国一覧</a><a href="${rel(1, "geshi/")}">夏至${GESHI.y}年の全国一覧</a>` : `<a href="${rel(1, "toji/")}">冬至${TOJI.y}年の全国一覧</a>`}<a href="${rel(1, "ranking/")}">日の出が早い県ランキング</a><a href="${rel(1, `tokyo/${mm2}/`)}">東京の${s.m}月カレンダー</a></div>`;

  writePage(`${kind}/index.html`, shell({
    path: `${kind}/`, depth: 1,
    title: `${name}${s.y}年はいつ？${s.m}月${s.d}日の日の出・日の入り時刻 全国一覧`,
    desc: `${s.y}年の${name}は${s.m}月${s.d}日。一年で最も昼が${kind === "toji" ? "短い" : "長い"}日の日の出・日の入り・南中時刻・昼の長さを全国47都道府県で一覧比較。東京の昼の長さは${lenStr(tokyo.len)}です。`,
    h1: `${name}${s.y}年（${s.m}月${s.d}日）の日の出・日の入り時刻`,
    breadcrumbs: [{ name: "ホーム", path: "" }, { name: `${name}${s.y}`, path: `${kind}/` }],
    body,
  }));
}

// ---- 日の出が早い県ランキング ----
function buildRanking() {
  const mk = (y, m, d) => PREFS.map(p => ({ ...p, t: dayTimes(y, m, d, p.lat, p.lng) }))
    .sort((a, b) => a.t.sunrise - b.t.sunrise);
  const geshiRank = mk(GESHI.y, GESHI.m, GESHI.d);
  const tojiRank = mk(TOJI.y, TOJI.m, TOJI.d);
  const table = ranked => `<div class="tbl"><table><thead><tr><th>#</th><th>都道府県</th><th>日の出</th><th>日の入り</th></tr></thead><tbody>${
    ranked.map((p, i) => `<tr><td>${i + 1}</td><td><a href="${rel(1, `${p.slug}/`)}">${esc(p.pref)}</a><small>（${esc(p.city)}）</small></td><td><strong>${hhmm(p.t.sunrise)}</strong></td><td>${hhmm(p.t.sunset)}</td></tr>`).join("\n")
  }</tbody></table></div>`;
  const g1 = geshiRank[0], gl = geshiRank[geshiRank.length - 1];
  const t1 = tojiRank[0], tl = tojiRank[tojiRank.length - 1];

  const body = `
<section class="feature"><p>「日本で一番日の出が早い県はどこ？」— 答えは季節で変わります。夏は太陽が北寄りから昇るため<strong>北にある県ほど早く</strong>、冬は南寄りから昇るため<strong>東にある県が早く</strong>なります。夏至（${GESHI.y}年${GESHI.m}月${GESHI.d}日）に最も日の出が早いのは${g1.pref}（${g1.city}）の${hhmm(g1.t.sunrise)}。冬至（${TOJI.y}年${TOJI.m}月${TOJI.d}日）では${t1.pref}（${t1.city}）の${hhmm(t1.t.sunrise)}が最も早くなります。</p></section>
<h2>夏至の日の出が早い県ランキング（${GESHI.y}年${GESHI.m}月${GESHI.d}日）</h2>
<p>最も早い${g1.pref}と最も遅い${gl.pref}（${hhmm(gl.t.sunrise)}）では約${Math.round(gl.t.sunrise - g1.t.sunrise)}分の差があります。緯度（南北の位置）の影響が強く出る並びです。</p>
${table(geshiRank)}
<h2>冬至の日の出が早い県ランキング（${TOJI.y}年${TOJI.m}月${TOJI.d}日）</h2>
<p>最も早い${t1.pref}と最も遅い${tl.pref}（${hhmm(tl.t.sunrise)}）では約${Math.round(tl.t.sunrise - t1.t.sunrise)}分の差があります。夏とは順位が大きく入れ替わり、経度（東西の位置）の影響が支配的になります。</p>
${table(tojiRank)}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>日本で一番早く朝日が見られる都道府県はどこですか？</dt><dd>夏は${g1.pref}など北の県、冬は${t1.pref}など東の県です。県庁所在地基準の理論値で、同じ県内でも東側や高台ではさらに早くなります。</dd>
<dt>なぜ季節でランキングが変わるのですか？</dt><dd>夏の太陽は北東から、冬の太陽は南東から昇ります。夏は北にあるほど昼が長い（＝日の出が早い）効果が効き、冬は逆に北の昼が短くなるため、単純に東にある県が有利になるからです。</dd>
<dt>元日の初日の出のランキングはありますか？</dt><dd><a href="${rel(1, HATSU)}">初日の出${HATSU_YEAR}年の全国ランキング</a>で47都道府県と名所の時刻を掲載しています。</dd>
</dl></section>
<h2>あわせて見る</h2>
<div class="links"><a href="${rel(1, HATSU)}">初日の出${HATSU_YEAR}</a><a href="${rel(1, "geshi/")}">夏至${GESHI.y}の全国一覧</a><a href="${rel(1, "toji/")}">冬至${TOJI.y}の全国一覧</a></div>`;

  writePage("ranking/index.html", shell({
    path: "ranking/", depth: 1,
    title: "日の出が早い県ランキング｜夏と冬で1位が変わる理由",
    desc: `日本で日の出が最も早い都道府県を夏至・冬至それぞれでランキング。夏は${g1.pref}（${hhmm(g1.t.sunrise)}）、冬は${t1.pref}（${hhmm(t1.t.sunrise)}）が最速。季節で順位が入れ替わる理由も解説します。`,
    h1: "日の出が早い県ランキング（夏至・冬至）",
    breadcrumbs: [{ name: "ホーム", path: "" }, { name: "日の出ランキング", path: "ranking/" }],
    body,
  }));
}

// ---- 解説記事: 日の入りが最も早い日は冬至ではない ----
function buildEarliestSunsetColumn() {
  // 冬至を挟む11月〜翌1月を走査して極値の日付を取る
  const scan = p => {
    const days = [];
    for (const [y, m] of [[TOJI.y, 11], [TOJI.y, 12], [TOJI.y + 1, 1]]) {
      for (let d = 1; d <= daysInMonth(y, m); d++) {
        const t = dayTimes(y, m, d, p.lat, p.lng);
        days.push({ y, m, d, ...t });
      }
    }
    return { earliestSet: minBy(days, r => r.sunset), latestRise: maxBy(days, r => r.sunrise) };
  };
  const cities = ["hokkaido", "miyagi", "tokyo", "osaka", "fukuoka", "okinawa"].map(s => bySlug[s]);
  const data = cities.map(p => ({ p, ...scan(p) }));
  const tokyo = data.find(x => x.p.slug === "tokyo");
  const tk = tokyo.earliestSet, tr = tokyo.latestRise;
  const tojiT = dayTimes(TOJI.y, TOJI.m, TOJI.d, tokyo.p.lat, tokyo.p.lng);

  const rows = data.map(({ p, earliestSet, latestRise }) =>
    `<tr><td><a href="${rel(2, `${p.slug}/`)}">${esc(p.pref)}</a><small>（${esc(p.city)}）</small></td><td>${earliestSet.m}月${earliestSet.d}日 <strong>${hhmm(earliestSet.sunset)}</strong></td><td>${TOJI.m}月${TOJI.d}日</td><td>${latestRise.m}月${latestRise.d}日 <strong>${hhmm(latestRise.sunrise)}</strong></td></tr>`).join("\n");

  const body = `
<section class="feature"><p>「冬至は一年で昼が最も短い日」— これは正しいのですが、「日の入りが最も早い日」でも「日の出が最も遅い日」でもありません。東京の場合、${TOJI.y}年に日の入りが最も早いのは<strong>${tk.m}月${tk.d}日の${hhmm(tk.sunset)}</strong>で、冬至（${TOJI.m}月${TOJI.d}日、日の入り${hhmm(tojiT.sunset)}）より2週間以上前。逆に日の出が最も遅いのは年が明けた<strong>${tr.m}月${tr.d}日の${hhmm(tr.sunrise)}</strong>です。</p></section>
<h2>なぜ冬至とずれるのか — 南中時刻が毎日遅れていく</h2>
<p>原因は「均時差」です。地球の公転軌道が楕円であること、地軸が傾いていることから、太陽が真南に来る時刻（南中時刻）は一年を通じて一定ではありません。12月から1月にかけて、南中時刻は<strong>毎日約30秒ずつ遅く</strong>なっていきます。</p>
<p>昼の長さ自体は冬至が最小ですが、昼全体の「中心時刻」が毎日後ろへずれていくため、日の入りの極小は冬至より前に、日の出の極大は冬至より後に押し出されます。イメージとしては「縮んでいく昼」が「後ろへ動く台の上」に載っている状態です。</p>
<h2>全国6都市の実際の日付（${TOJI.y}年）</h2>
<div class="tbl"><table><thead><tr><th>都市</th><th>日の入りが最も早い日</th><th>冬至</th><th>日の出が最も遅い日</th></tr></thead><tbody>${rows}</tbody></table></div>
<p>どの都市でも「日の入り最早 → 冬至 → 日の出最遅」の順に並び、南に行くほどずれ幅が大きくなります。沖縄では日の出が最も遅い日が1月中旬まで下がります。</p>
<h2>夏至でも同じことが起きる</h2>
<p>向きが逆になるだけで夏も同様です。日の出が最も早いのは夏至の約1週間前、日の入りが最も遅いのは夏至の約1週間後になります。夕方の明るさが「もう夏至を過ぎたのにまだ延びている」ように感じるのはこのためです。</p>
<section class="faq"><h2>よくある質問</h2><dl>
<dt>冬至は何が「一番」の日なのですか？</dt><dd>昼の長さ（日の出から日の入りまで）が一年で最も短い日です。東京の冬至の昼は${lenStr(tojiT.sunset - tojiT.sunrise)}です。</dd>
<dt>日の入りが早くなるのはいつまでですか？</dt><dd>東京では${tk.m}月${tk.d}日ごろが底で、それ以降は冬至を待たずに日の入りが遅くなり始めます。年内でも夕方は少しずつ明るくなっていきます。</dd>
<dt>初日の出は一年で最も遅い日の出ですか？</dt><dd>近いですが厳密には違います。東京では${tr.m}月${tr.d}日ごろの日の出が最も遅く、元日はその数日前にあたります。<a href="${rel(2, HATSU)}">初日の出${HATSU_YEAR}年の時刻一覧</a>もご覧ください。</dd>
</dl></section>
<h2>あわせて見る</h2>
<div class="links"><a href="${rel(2, "toji/")}">冬至${TOJI.y}の全国一覧</a><a href="${rel(2, "geshi/")}">夏至${GESHI.y}の全国一覧</a><a href="${rel(2, "tokyo/12/")}">東京の12月カレンダー</a><a href="${rel(2, HATSU)}">初日の出${HATSU_YEAR}</a></div>`;

  writePage("column/earliest-sunset/index.html", shell({
    path: "column/earliest-sunset/", depth: 2,
    title: `日の入りが最も早い日は冬至ではない｜東京は${tk.m}月${tk.d}日`,
    desc: `一年で日の入りが最も早いのは冬至（${TOJI.m}月${TOJI.d}日）ではなく、東京では${tk.m}月${tk.d}日の${hhmm(tk.sunset)}。日の出が最も遅いのは年明け${tr.m}月${tr.d}日。均時差によるずれの仕組みを全国6都市の実データで解説します。`,
    h1: "日の入りが最も早い日は、冬至ではない",
    breadcrumbs: [{ name: "ホーム", path: "" }, { name: "日の入りが最も早い日", path: "column/earliest-sunset/" }],
    body,
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

  const hatsuPromo = `<section class="feature"><p>🌅 <a href="${rel(0, HATSU)}"><strong>初日の出${HATSU_YEAR}年 全国47都道府県の時刻一覧</strong></a>${SPOTS.length ? ` ／ <a href="${rel(0, `${HATSU}meisho/`)}">名所${SPOTS.length}選（標高補正つき）</a>` : ""}</p>
<div class="links"><a href="${rel(0, "toji/")}">冬至${TOJI.y}の全国一覧</a><a href="${rel(0, "geshi/")}">夏至${GESHI.y}の全国一覧</a><a href="${rel(0, "ranking/")}">日の出が早い県ランキング</a><a href="${rel(0, "column/earliest-sunset/")}">コラム：日の入りが最も早い日は冬至ではない</a></div></section>`;
  writePage("index.html", shell({
    path: "", depth: 0,
    title: "日の出・日の入り時刻カレンダー｜全国47都道府県",
    desc: "全国47都道府県の今日の日の出・日の入り・南中時刻・昼の長さを一覧で確認。都道府県別に毎月の日別カレンダー、初日の出の時刻も掲載しています。",
    h1: `全国の日の出・日の入り時刻（<span data-today-date>${TODAY.y}年${TODAY.m}月${TODAY.d}日</span>）`,
    breadcrumbs: [],
    body: hatsuPromo + sections,
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
const ranked = hatsuData();
buildHatsuIndex(ranked);
ranked.forEach((p, i) => buildHatsuPref(p, i + 1, ranked));
buildMeisho();
buildSolstice("toji");
buildSolstice("geshi");
buildRanking();
buildEarliestSunsetColumn();
buildHome();
build404();
buildSitemap();
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

// 整合性チェック: リンク先の実在・ページ数・URLプレフィックス
// ponytail: rel()のdepth引数の正しさ自体は検証していない（リンク先の実在のみ）。階層を増やす時はdepthの目視確認が必要
for (const t of linkTargets) {
  const f = path.join(OUT, t, "index.html");
  if (!fs.existsSync(f)) throw new Error(`BROKEN LINK TARGET: ${t}`);
}
const expected = 1 + 47 + 47 * 12 + 1 + 47 + (SPOTS.length ? 1 : 0) + 4; // +4: toji/geshi/ranking/column
if (emittedUrls.length !== expected) throw new Error(`page count ${emittedUrls.length} != ${expected}`);
if (!emittedUrls.every(u => u.startsWith(BASE))) throw new Error("URL outside BASE");
console.log(`OK: ${emittedUrls.length} pages + 404 + sitemap generated for ${TODAY_STR}`);
