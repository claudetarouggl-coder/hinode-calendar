"use strict";
// フルNOAA太陽位置計算（Julian century展開版、精度±10秒程度）
// <client>
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const JST_OFFSET_MIN = 540;

function solarBasis(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = ((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360 + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = rad(M);
  const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T)
    + Math.sin(3 * Mr) * 0.000289;
  const omega = rad(125.04 - 1934.136 * T);
  const lambda = rad(L0 + C - 0.00569 - 0.00478 * Math.sin(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = rad(eps0 + 0.00256 * Math.cos(omega));
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const y = Math.tan(eps / 2) ** 2;
  const L0r = rad(L0);
  const eqtime = 4 * deg(
    y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr)
    + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r)
    - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
  return { decl, eqtime };
}

// 指定日のイベント時刻をJSTの分で返す。zenith: 90.833=日の出入り, 96=市民薄明
function solarEvent(year, month, day, lat, lng, zenith, rising) {
  const baseMs = Date.UTC(year, month - 1, day);
  let minutes = 720 - 4 * lng; // 太陽正午UTCの初期推定
  for (let i = 0; i < 2; i++) {
    const jd = (baseMs + minutes * 60000) / 86400000 + 2440587.5;
    const { decl, eqtime } = solarBasis(jd);
    const cosHa = (Math.cos(rad(zenith)) - Math.sin(rad(lat)) * Math.sin(decl))
      / (Math.cos(rad(lat)) * Math.cos(decl));
    if (cosHa > 1 || cosHa < -1) return null;
    const ha = deg(Math.acos(cosHa));
    minutes = 720 - 4 * (lng + (rising ? ha : -ha)) - eqtime;
  }
  return minutes + JST_OFFSET_MIN;
}

function solarNoon(year, month, day, lng) {
  const baseMs = Date.UTC(year, month - 1, day);
  let minutes = 720 - 4 * lng;
  for (let i = 0; i < 2; i++) {
    const jd = (baseMs + minutes * 60000) / 86400000 + 2440587.5;
    minutes = 720 - 4 * lng - solarBasis(jd).eqtime;
  }
  return minutes + JST_OFFSET_MIN;
}

// 1日分まとめて計算。elevM>0なら地平線の伏角補正（初日の出名所用）
function dayTimes(year, month, day, lat, lng, elevM = 0) {
  const zen = 90.833 + (elevM > 0 ? 0.0293 * Math.sqrt(elevM) : 0);
  return {
    dawn: solarEvent(year, month, day, lat, lng, 96, true),
    sunrise: solarEvent(year, month, day, lat, lng, zen, true),
    noon: solarNoon(year, month, day, lng),
    sunset: solarEvent(year, month, day, lat, lng, zen, false),
    dusk: solarEvent(year, month, day, lat, lng, 96, false),
  };
}

const hhmm = min => {
  const m = Math.round(min);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};
// </client>

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

module.exports = { solarBasis, solarEvent, solarNoon, dayTimes, hhmm, daysInMonth, JST_OFFSET_MIN };

// 自己検証: 国立天文台の公表値（東京・札幌）との一致を±1.5分で確認
if (require.main === module) {
  const assert = require("assert");
  const near = (actual, hhmmStr, tolMin = 1.5) => {
    const [h, mm] = hhmmStr.split(":").map(Number);
    assert.ok(Math.abs(actual - (h * 60 + mm)) <= tolMin,
      `expected ~${hhmmStr}, got ${hhmm(actual)}`);
  };
  const t1 = dayTimes(2026, 12, 22, 35.69, 139.69); // 東京 冬至
  near(t1.sunrise, "6:47"); near(t1.sunset, "16:32");
  const t2 = dayTimes(2027, 1, 1, 35.69, 139.69);   // 東京 元日
  near(t2.sunrise, "6:51"); near(t2.sunset, "16:39");
  const t3 = dayTimes(2026, 6, 21, 43.06, 141.35);  // 札幌 夏至
  near(t3.sunrise, "3:55"); near(t3.sunset, "19:18");
  // 市民薄明は日の出より前、差は15〜45分の範囲（東京冬至は約28分）
  const twiDiff = t1.sunrise - t1.dawn;
  assert.ok(twiDiff > 15 && twiDiff < 45, `twilight diff ${twiDiff}`);
  assert.strictEqual(daysInMonth(2027, 2), 28);
  assert.strictEqual(daysInMonth(2028, 2), 29);
  console.log("solar.js (full NOAA) self-check OK");
}
