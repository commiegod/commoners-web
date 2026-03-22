import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// ── Constants ─────────────────────────────────────────────────────────────────
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

// Data lives in data/midevils/ inside the project; can be overridden by env var
// for local development with a full archive (images) alongside.
const DATA_DIR = process.env.MIDEVILS_ARCHIVE_PATH
  ? resolve(process.env.MIDEVILS_ARCHIVE_PATH)
  : resolve(process.cwd(), "data/midevils");

// ── Caching ───────────────────────────────────────────────────────────────────
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Date helpers ──────────────────────────────────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Python strftime %Y-W%W equivalent: Monday-based week number, 0-padded */
function weekKey(dt) {
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  // Rewind to Monday of this week
  const day = d.getUTCDay(); // 0=Sun
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  // Week number = floor(days since Jan 1 / 7), where Jan 1 is day 0
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.floor((d - yearStart) / (7 * 24 * 60 * 60 * 1000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function weekLabel(dt) {
  // Monday of the week
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).replace(/,\s*\d{4}$/, (m) => m); // keep year
}

function monthKey(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

// ── Data loading ──────────────────────────────────────────────────────────────
function readJSON(relPath) {
  const p = join(DATA_DIR, relPath);
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return [];
  }
}

/** Extract tweet ID from a twitter/x URL */
function tweetIdFromUrl(url) {
  return (url ?? "").match(/\/status\/(\d+)/)?.[1] ?? "";
}

function buildData() {
  const discord     = readJSON("discord_registry.json");
  const milestones  = readJSON("top_tweets/top_tweets_registry.json");
  const artistTwts  = readJSON("top_tweets/artist_tweets_registry.json");
  const highlights  = readJSON("top_tweets/community_highlights_registry.json");
  const memes       = readJSON("meme_registry.json");

  // ── Index milestone tweets (@MidEvilsNFT) by week ─────────────────────────
  const tweetByWeek = new Map();
  for (const t of milestones) {
    const dt = parseDate(t.date);
    if (!dt) continue;
    const wk = weekKey(dt);
    if (!tweetByWeek.has(wk)) tweetByWeek.set(wk, []);
    tweetByWeek.get(wk).push({
      url:        t.url,
      tweet_id:   tweetIdFromUrl(t.url),
      username:   t.username ?? "MidEvilsNFT",
      text:       t.text ?? "",
      date:       t.date.slice(0, 10),
      likes:      t.likes   ?? 0,
      views:      t.views   ?? 0,
      reposts:    t.reposts ?? 0,
    });
  }

  // ── Index artist tweets (@sircandyapple, @jonnydegods) by week ────────────
  const artistByWeek = new Map();
  for (const a of artistTwts) {
    const dt = parseDate(a.date);
    if (!dt) continue;
    const wk = weekKey(dt);
    if (!artistByWeek.has(wk)) artistByWeek.set(wk, []);
    artistByWeek.get(wk).push({
      url:        a.url,
      tweet_id:   a.tweet_id ?? tweetIdFromUrl(a.url),
      username:   a.username ?? "",
      text:       a.text ?? "",
      date:       a.date.slice(0, 10),
      likes:      a.likes   ?? 0,
      views:      a.views   ?? 0,
      reposts:    a.reposts ?? 0,
    });
  }

  // ── Index community highlights by week ───────────────────────────────────
  const highlightByWeek = new Map();
  for (const h of highlights) {
    const dt = parseDate(h.date);
    if (!dt) continue;
    const wk = weekKey(dt);
    if (!highlightByWeek.has(wk)) highlightByWeek.set(wk, []);
    highlightByWeek.get(wk).push({
      url:        h.url,
      tweet_id:   h.tweet_id ?? tweetIdFromUrl(h.url),
      username:   h.username ?? "",
      text:       h.text ?? "",
      date:       h.date.slice(0, 10),
      likes:      h.likes   ?? 0,
      views:      h.views   ?? 0,
      reposts:    h.reposts ?? 0,
    });
  }

  // ── Index community tweets (meme_registry) by week ────────────────────────
  const commByWeek = new Map();
  for (const ct of memes) {
    if (!ct.downloaded) continue;
    const dt = parseDate(ct.date);
    if (!dt) continue;
    const wk = weekKey(dt);
    if (!commByWeek.has(wk)) commByWeek.set(wk, []);
    commByWeek.get(wk).push({
      // Use the original pbs.twimg.com URL directly — no storage needed
      file:      ct.img_url ?? `by-month/${ct.month}/${ct.filename}`,
      direct:    !!ct.img_url,
      username:  ct.username,
      tweetUrl:  ct.tweet_url ?? "",
      date:      ct.date,
      month:     ct.month,
      score:     ct.score ?? 0,
      source:    "twitter",
    });
  }

  // ── Build week buckets ────────────────────────────────────────────────────
  const weeks = new Map(); // weekKey → bucket

  function ensureWeek(wk, dt) {
    if (!weeks.has(wk)) {
      weeks.set(wk, {
        count:      0,
        channels:   {},
        images:     [],
        commTweets: [],
        start:      null,
        month:      "",
        weekLabel:  "",
      });
    }
    const bucket = weeks.get(wk);
    if (bucket.start === null) {
      // Store Monday of the week as ISO string
      const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      const day = d.getUTCDay();
      const offset = day === 0 ? -6 : 1 - day;
      d.setUTCDate(d.getUTCDate() + offset);
      bucket.start      = d.toISOString().slice(0, 10);
      bucket.month      = monthKey(dt);
      bucket.weekLabel  = weekLabel(dt);
    }
    return bucket;
  }

  // Discord messages
  for (const m of discord) {
    const ts = m.timestamp ?? "";
    const fn = m.filename_local ?? "";
    const ch = m.channel ?? "unknown";
    if (!ts || !fn || !m.downloaded) continue;
    const dt = parseDate(ts);
    if (!dt) continue;

    // Skip placeholder (expired Discord CDN) files
    if (fn.includes("be6cfc6c")) continue;

    const wk     = weekKey(dt);
    const bucket = ensureWeek(wk, dt);
    bucket.count++;
    bucket.channels[ch] = (bucket.channels[ch] ?? 0) + 1;
    // Prefer direct Twitter URL for embed-type entries (no storage needed)
    const twitterUrl = m.type === "embed" && m.url?.includes("twimg.com") ? m.url : null;
    bucket.images.push({
      file:    twitterUrl ?? `by-month/discord/${m.month}/${ch}/${fn}`,
      direct:  !!twitterUrl,
      channel: ch,
      author:  m.author ?? "",
      ts:      ts.slice(0, 10),
    });
  }

  // Community tweets
  for (const [wk, cts] of commByWeek) {
    const dt = parseDate(cts[0].date);
    if (!dt) continue;
    const bucket = ensureWeek(wk, dt);
    bucket.count       += cts.length;
    bucket.channels["twitter"] = (bucket.channels["twitter"] ?? 0) + cts.length;
    bucket.commTweets   = cts;
  }

  // ── Sort weeks, compute scores ────────────────────────────────────────────
  const sortedWeeks = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxCount    = sortedWeeks.reduce((m, [, v]) => Math.max(m, v.count), 1);

  const resultWeeks = sortedWeeks.map(([wk, data]) => {
    const comm        = data.commTweets;
    const tweetScore  = comm.reduce((s, ct) => s + (ct.score ?? 0), 0);
    const discordCnt  = Math.max(0, data.count - comm.length);
    const weekScore   = tweetScore + discordCnt * 5;

    return {
      week:       wk,
      start:      data.start,
      month:      data.month,
      weekLabel:  data.weekLabel,
      count:      data.count,
      score:      Math.round(weekScore * 10) / 10,
      channels:   data.channels,
      images:     data.images,
      commTweets: comm,
      milestones:    tweetByWeek.get(wk)    ?? [],
      artistTweets:  artistByWeek.get(wk)   ?? [],
      highlights:    highlightByWeek.get(wk) ?? [],
    };
  });

  const maxScore = resultWeeks.reduce((m, w) => Math.max(m, w.score), 1);

  // ── Group by month ────────────────────────────────────────────────────────
  const monthMap = new Map();
  for (const w of resultWeeks) {
    if (!monthMap.has(w.month)) monthMap.set(w.month, []);
    monthMap.get(w.month).push(w);
  }

  const months = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, wks]) => ({ key, label: monthLabel(key), weeks: wks }));

  return {
    weeks:         resultWeeks,
    months,
    maxCount,
    maxScore,
    totalImages:    sortedWeeks.reduce((s, [, v]) => s + v.count, 0),
    channelColors:  CHANNEL_COLORS,
    totalMilestones: milestones.length,
    totalArtist:     artistTwts.length,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const now = Date.now();
    if (!_cache || now - _cacheTime > CACHE_TTL) {
      _cache     = buildData();
      _cacheTime = now;
    }
    return NextResponse.json(_cache, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[midevils/timeline]", err);
    return NextResponse.json({ error: "Failed to build timeline" }, { status: 500 });
  }
}
