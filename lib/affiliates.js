"use strict";
// 楽天アフィリエイトのリンクデータ（2026-08-15 生成、アカウント: 専用楽天アカウント）
// goods: {label, url, note} — url は楽天アフィリエイトで生成・検証済みのリンク
// 楽天市場の検索リンクはID固定・pc=差し替えで構築可能（curl 302検証済み）
const LINK_ID = "5983ef9a.5904b4f6.5983ef9b.958d8579";
const UT = "eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9";
const searchLink = keyword =>
  `https://hb.afl.rakuten.co.jp/hgc/${LINK_ID}/?pc=${encodeURIComponent(`https://search.rakuten.co.jp/search/mall/${keyword}/`)}&link_type=text&ut=${UT}`;

module.exports = {
  // 秋分ページ用（秋のお彼岸の中日）
  shubun: [
    { label: "おはぎ（お彼岸のお供え）", url: searchLink("おはぎ お彼岸") },
    { label: "お線香・進物用", url: searchLink("お線香 進物") },
    { label: "仏花・お供え花", url: searchLink("仏花 お供え") },
  ],
  // 春分ページ用（春のお彼岸の中日）
  shunbun: [
    { label: "ぼたもち（お彼岸のお供え）", url: searchLink("ぼたもち お彼岸") },
    { label: "お線香・進物用", url: searchLink("お線香 進物") },
    { label: "仏花・お供え花", url: searchLink("仏花 お供え") },
  ],
  // 冬至ページ用（ゆず湯・冬至かぼちゃの季節需要）
  toji: [
    { label: "ゆず（ゆず湯用）", url: searchLink("ゆず 柚子湯"), note: "冬至の柚子湯は5〜6個入れると香りが立ちます" },
    { label: "ゆず入浴剤", url: searchLink("ゆず 入浴剤"), note: "生のゆずが手に入らない年はこちらで手軽に" },
    { label: "かぼちゃ（冬至かぼちゃ用）", url: searchLink("かぼちゃ 北海道"), note: "冬至にかぼちゃを食べると風邪をひかないと言われます" },
  ],
  goods: [
    {
      label: "貼るカイロ（楽天市場で探す）",
      url: "https://hb.afl.rakuten.co.jp/hgc/5983ef9a.5904b4f6.5983ef9b.958d8579/?pc=https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F%E8%B2%BC%E3%82%8B%E3%82%AB%E3%82%A4%E3%83%AD%2F&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9",
      note: "夜明け前の待機は想像以上に冷えます",
    },
    {
      label: "防寒手袋（スマホ対応）",
      url: "https://hb.afl.rakuten.co.jp/hgc/5983ef9a.5904b4f6.5983ef9b.958d8579/?pc=https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F%E9%98%B2%E5%AF%92%E6%89%8B%E8%A2%8B%2F&link_type=text&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9",
      note: "撮影するなら操作できる手袋を",
    },
    {
      label: "双眼鏡",
      url: "https://hb.afl.rakuten.co.jp/hgc/5983ef9a.5904b4f6.5983ef9b.958d8579/?pc=https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F%E5%8F%8C%E7%9C%BC%E9%8F%A1%2F&link_type=text&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9",
      note: "水平線の第一光をいち早く",
    },
    {
      label: "保温ボトル・魔法瓶",
      url: "https://hb.afl.rakuten.co.jp/hgc/5983ef9a.5904b4f6.5983ef9b.958d8579/?pc=https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F%E3%82%B9%E3%83%86%E3%83%B3%E3%83%AC%E3%82%B9%E3%83%9C%E3%83%88%E3%83%AB%20%E4%BF%9D%E6%B8%A9%2F&link_type=text&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9",
      note: "温かい飲み物があると待ち時間が変わります",
    },
    {
      label: "楽天トラベルで初日の出スポット近くの宿を探す",
      url: "https://hb.afl.rakuten.co.jp/hgc/5983f1d4.14a780e1.5983f1d5.52da04aa/?pc=https%3A%2F%2Ftravel.rakuten.co.jp%2F&link_type=text&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9",
      note: "前泊すれば元日の早起きが圧倒的に楽に",
    },
  ],
};
