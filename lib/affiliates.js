"use strict";
// 楽天アフィリエイトのリンクデータ（2026-08-15 生成、アカウント: 専用楽天アカウント）
// goods: {label, url, note} — url は楽天アフィリエイトで生成・検証済みのリンク
// 楽天市場の検索リンクはID固定・pc=差し替えで構築可能（curl 302検証済み）
const LINK_ID = "56939e6e.b614e71e.56939e6f.e56659e4";
const UT = "eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9";
const searchLink = keyword =>
  `https://hb.afl.rakuten.co.jp/hgc/${LINK_ID}/?pc=${encodeURIComponent(`https://search.rakuten.co.jp/search/mall/${keyword}/`)}&link_type=text&ut=${UT}`;

module.exports = {
  // 冬至ページ用（ゆず湯・冬至かぼちゃの季節需要）
  toji: [
    { label: "ゆず（ゆず湯用）", url: searchLink("ゆず 柚子湯"), note: "冬至の柚子湯は5〜6個入れると香りが立ちます" },
    { label: "ゆず入浴剤", url: searchLink("ゆず 入浴剤"), note: "生のゆずが手に入らない年はこちらで手軽に" },
    { label: "かぼちゃ（冬至かぼちゃ用）", url: searchLink("かぼちゃ 北海道"), note: "冬至にかぼちゃを食べると風邪をひかないと言われます" },
  ],
  goods: [
    {
      label: "貼るカイロ（楽天市場で探す）",
      url: "https://hb.afl.rakuten.co.jp/hgc/56939e6e.b614e71e.56939e6f.e56659e4/?pc=https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F%E8%B2%BC%E3%82%8B%E3%82%AB%E3%82%A4%E3%83%AD%2F&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9",
      note: "夜明け前の待機は想像以上に冷えます",
    },
    {
      label: "防寒手袋（スマホ対応）",
      url: "https://hb.afl.rakuten.co.jp/hgc/56939e6e.b614e71e.56939e6f.e56659e4/?pc=https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F%E9%98%B2%E5%AF%92%E6%89%8B%E8%A2%8B%2F&link_type=text&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9",
      note: "撮影するなら操作できる手袋を",
    },
    {
      label: "双眼鏡",
      url: "https://hb.afl.rakuten.co.jp/hgc/56939e6e.b614e71e.56939e6f.e56659e4/?pc=https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F%E5%8F%8C%E7%9C%BC%E9%8F%A1%2F&link_type=text&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9",
      note: "水平線の第一光をいち早く",
    },
    {
      label: "保温ボトル・魔法瓶",
      url: "https://hb.afl.rakuten.co.jp/hgc/56939e6e.b614e71e.56939e6f.e56659e4/?pc=https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F%E3%82%B9%E3%83%86%E3%83%B3%E3%83%AC%E3%82%B9%E3%83%9C%E3%83%88%E3%83%AB%20%E4%BF%9D%E6%B8%A9%2F&link_type=text&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9",
      note: "温かい飲み物があると待ち時間が変わります",
    },
    {
      label: "楽天トラベルで初日の出スポット近くの宿を探す",
      url: "https://hb.afl.rakuten.co.jp/hgc/5693a0fc.6b045491.5693a0fd.b2ef0c3c/?pc=https%3A%2F%2Ftravel.rakuten.co.jp%2F&link_type=text&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9",
      note: "前泊すれば元日の早起きが圧倒的に楽に",
    },
  ],
};
