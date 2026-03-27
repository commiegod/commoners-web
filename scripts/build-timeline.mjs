#!/usr/bin/env node
/**
 * scripts/build-timeline.mjs
 *
 * Pre-builds the MidEvils timeline JSON at deploy time so the API route can
 * serve a static file instead of computing on every request.
 *
 * Run automatically via the "prebuild" npm script before `next build`.
 * Output: data/midevils/timeline-prebuilt.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

const CHANNEL_COLORS = {
  "twitter-raids": "#1d9bf0",
  "alpha-chat":    "#7c5cfc",
  "peasant-chat":  "#fc5c9c",
  "flex-chat":     "#f5a623",
  "midevils-bst":  "#3ecf8e",
  "events":        "#ff6b6b",
  "gmid":          "#aaaaaa",
  "twitter":       "#1d9bf0",
};

const DATA_DIR = process.env.MIDEVILS_ARCHIVE_PATH
  ? resolve(process.env.MIDEVILS_ARCHIVE_PATH)
  : resolve(PROJECT_ROOT, "data/midevils");

const OUT_PATH         = join(PROJECT_ROOT, "data/midevils/timeline-prebuilt.json");
const SUMMARY_PATH     = join(PROJECT_ROOT, "data/midevils/timeline-summary.json");
const WEEKS_DIR        = join(PROJECT_ROOT, "data/midevils/weeks");

// ── Helpers (identical to route.js) ──────────────────────────────────────────

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function weekKey(dt) {
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.floor((d - yearStart) / (7 * 24 * 60 * 60 * 1000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function weekLabel(dt) {
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC", month: "short", day: "numeric", year: "numeric",
  }).replace(/,\s*\d{4}$/, (m) => m);
}

function monthKey(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC", month: "long", year: "numeric",
  });
}

function readJSON(relPath) {
  const p = join(DATA_DIR, relPath);
  if (!existsSync(p)) { console.warn(`  [warn] missing: ${p}`); return []; }
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.warn(`  [warn] parse error: ${p}`, e.message);
    return [];
  }
}

function tweetIdFromUrl(url) {
  return (url ?? "").match(/\/status\/(\d+)/)?.[1] ?? "";
}

// ── Build (identical logic to route.js buildData()) ───────────────────────────

function build() {
  console.log("Building timeline…");
  console.log(`  data dir: ${DATA_DIR}`);

  const discord        = readJSON("discord_registry.json");
  const officialTweets = readJSON("top_tweets/top_tweets_registry.json");
  const artistTwts     = readJSON("top_tweets/artist_tweets_registry.json");
  const memes          = readJSON("meme_registry.json");

  console.log(`  loaded: discord=${discord.length} officialTweets=${officialTweets.length} artist=${artistTwts.length} memes=${memes.length}`);

  const tweetByWeek = new Map();
  for (const t of officialTweets) {
    const dt = parseDate(t.date); if (!dt) continue;
    const wk = weekKey(dt);
    if (!tweetByWeek.has(wk)) tweetByWeek.set(wk, []);
    tweetByWeek.get(wk).push({
      url: t.url, tweet_id: tweetIdFromUrl(t.url),
      username: t.username ?? "MidEvilsNFT", text: t.text ?? "",
      date: t.date.slice(0, 10), likes: t.likes ?? 0, views: t.views ?? 0, reposts: t.reposts ?? 0,
    });
  }

  const timelineStart = discord.reduce((min, m) => {
    if (!m.downloaded || !m.timestamp) return min;
    const dt = parseDate(m.timestamp);
    return dt && (!min || dt < min) ? dt : min;
  }, null);

  const artistByWeek = new Map();
  for (const a of artistTwts) {
    const dt = parseDate(a.date); if (!dt) continue;
    if (timelineStart && dt < timelineStart) continue;
    const wk = weekKey(dt);
    if (!artistByWeek.has(wk)) artistByWeek.set(wk, []);
    artistByWeek.get(wk).push({
      url: a.url, tweet_id: a.tweet_id ?? tweetIdFromUrl(a.url),
      username: a.username ?? "", text: a.text ?? "",
      date: a.date.slice(0, 10), likes: a.likes ?? 0, views: a.views ?? 0, reposts: a.reposts ?? 0,
    });
  }

  const commByWeek = new Map();
  for (const ct of memes) {
    if (!ct.downloaded) continue;
    const dt = parseDate(ct.date); if (!dt) continue;
    const wk = weekKey(dt);
    if (!commByWeek.has(wk)) commByWeek.set(wk, []);
    commByWeek.get(wk).push({
      file: ct.img_url ?? `by-month/${ct.month}/${ct.filename}`,
      direct: !!ct.img_url, username: ct.username,
      tweetUrl: ct.tweet_url ?? "", date: ct.date,
      month: ct.month, score: ct.score ?? 0, source: "twitter",
    });
  }

  const weeks = new Map();

  function ensureWeek(wk, dt) {
    if (!weeks.has(wk)) weeks.set(wk, { count: 0, channels: {}, images: [], commTweets: [], start: null, month: "", weekLabel: "" });
    const bucket = weeks.get(wk);
    if (bucket.start === null) {
      const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
      bucket.start     = d.toISOString().slice(0, 10);
      bucket.month     = monthKey(dt);
      bucket.weekLabel = weekLabel(dt);
    }
    return bucket;
  }

  for (const m of discord) {
    const ts = m.timestamp ?? "", fn = m.filename_local ?? "", ch = m.channel ?? "unknown";
    if (!ts || !fn || !m.downloaded) continue;
    const dt = parseDate(ts); if (!dt) continue;
    if (fn.includes("be6cfc6c")) continue;
    const wk = weekKey(dt);
    const bucket = ensureWeek(wk, dt);
    bucket.count++;
    bucket.channels[ch] = (bucket.channels[ch] ?? 0) + 1;
    const twitterUrl = m.type === "embed" && m.url?.includes("twimg.com") ? m.url : null;
    bucket.images.push({
      file: twitterUrl ?? `by-month/discord/${m.month}/${ch}/${fn}`,
      direct: !!twitterUrl, channel: ch, author: m.author ?? "", ts: ts.slice(0, 10),
    });
  }

  for (const [wk, cts] of commByWeek) {
    const dt = parseDate(cts[0].date); if (!dt) continue;
    const bucket = ensureWeek(wk, dt);
    bucket.count += cts.length;
    bucket.channels["twitter"] = (bucket.channels["twitter"] ?? 0) + cts.length;
    bucket.commTweets = cts;
  }

  for (const [wk, items] of tweetByWeek)  { const dt = parseDate(items[0].date); if (dt) ensureWeek(wk, dt); }
  for (const [wk, items] of artistByWeek) { const dt = parseDate(items[0].date); if (dt) ensureWeek(wk, dt); }

  const sortedWeeks = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxCount    = sortedWeeks.reduce((m, [, v]) => Math.max(m, v.count), 1);

  const resultWeeks = sortedWeeks.map(([wk, data]) => {
    const comm       = data.commTweets;
    const tweetScore = comm.reduce((s, ct) => s + (ct.score ?? 0), 0);
    const weekScore  = tweetScore + Math.max(0, data.count - comm.length) * 5;
    return {
      week: wk, start: data.start, month: data.month, weekLabel: data.weekLabel,
      count: data.count, score: Math.round(weekScore * 10) / 10,
      channels: data.channels, images: data.images, commTweets: comm,
      officialTweets: tweetByWeek.get(wk)  ?? [],
      artistTweets:   artistByWeek.get(wk) ?? [],
    };
  });

  const maxScore = resultWeeks.reduce((m, w) => Math.max(m, w.score), 1);

  const monthMap = new Map();
  for (const w of resultWeeks) {
    if (!monthMap.has(w.month)) monthMap.set(w.month, []);
    monthMap.get(w.month).push(w);
  }

  const months = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, wks]) => ({ key, label: monthLabel(key), weeks: wks }));

  const IMAGE_BASE = process.env.NEXT_PUBLIC_MIDEVILS_IMAGE_BASE_URL ?? "";

  // Build summary weeks (no images/tweets arrays — just pulse metadata + 3 preview URLs)
  const summaryWeeks = resultWeeks.map((w) => {
    // Collect candidate preview images: Discord R2 images first, then Twitter embeds
    const r2Images  = w.images.filter((im) => !im.direct);
    const twImages  = w.images.filter((im) =>  im.direct);
    const commTw    = w.commTweets.filter((ct) => ct.direct);
    const candidates = [...r2Images, ...twImages, ...commTw];

    const previews = candidates.slice(0, 3).map((im) => {
      const path = im.file ?? "";
      return (path.startsWith("http") || !IMAGE_BASE)
        ? path
        : `${IMAGE_BASE}/${path}`;
    });

    return {
      week:           w.week,
      start:          w.start,
      month:          w.month,
      weekLabel:      w.weekLabel,
      count:          w.count,
      score:          w.score,
      channels:       w.channels,
      previews,
      hasOfficialTweets: w.officialTweets.length > 0,
      hasArtist:         w.artistTweets.length   > 0,
    };
  });

  return {
    weeks: resultWeeks, months, maxCount, maxScore,
    totalImages:          sortedWeeks.reduce((s, [, v]) => s + v.count, 0),
    channelColors:        CHANNEL_COLORS,
    totalOfficialTweets:  officialTweets.length,
    totalArtist:          [...artistByWeek.values()].reduce((s, v) => s + v.length, 0),
    builtAt:         new Date().toISOString(),
    // Extras used by split-output phase below
    _summaryWeeks:   summaryWeeks,
    _months:         months,
  };
}

// ── Run ───────────────────────────────────────────────────────────────────────

const t0 = Date.now();
const result = build();

// 1. Full prebuilt (backward compat)
const { _summaryWeeks, _months, ...prebuilt } = result;
writeFileSync(OUT_PATH, JSON.stringify(prebuilt));
console.log(`  written: ${OUT_PATH}`);

// 2. Per-week files
mkdirSync(WEEKS_DIR, { recursive: true });
for (const w of result.weeks) {
  const weekFile = join(WEEKS_DIR, `${w.week}.json`);
  writeFileSync(weekFile, JSON.stringify(w));
}
console.log(`  written: ${WEEKS_DIR}/ (${result.weeks.length} files)`);

// 3. Summary (lightweight pulse — no images/tweets arrays)
const summary = {
  weeks:          _summaryWeeks,
  months:         _months.map(({ key, label, weeks }) => ({
    key, label,
    weeks: weeks.map((w) => w.week),   // just week keys — no full data
  })),
  maxCount:       result.maxCount,
  maxScore:       result.maxScore,
  totalImages:    result.totalImages,
  channelColors:  result.channelColors,
  totalOfficialTweets: result.totalOfficialTweets,
  totalArtist:         result.totalArtist,
  builtAt:        result.builtAt,
};
writeFileSync(SUMMARY_PATH, JSON.stringify(summary));
console.log(`  written: ${SUMMARY_PATH}`);

const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
console.log(`  weeks=${result.weeks.length} months=${result.months.length} images=${result.totalImages}`);
console.log(`  done in ${elapsed}s`);
