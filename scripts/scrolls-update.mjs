#!/usr/bin/env node
/**
 * scrolls-update.mjs
 *
 * Single local script that crawls Twitter + Discord for MidEvils content,
 * updates registries, rebuilds the timeline, and pushes to trigger Vercel deploy.
 *
 * Run manually:
 *   cd ~/common/web && node scripts/scrolls-update.mjs
 *
 * Or via cron (weekly Monday 9am):
 *   0 9 * * 1 cd ~/common/web && node scripts/scrolls-update.mjs >> ~/scrolls-update.log 2>&1
 *
 * Prerequisites:
 *   npm install playwright   (if not already)
 *   npx playwright install chromium
 *
 * Flags:
 *   --dry-run       Print what would change, don't write
 *   --no-push       Update files but skip git push
 *   --no-discord    Skip Discord crawl
 *   --no-twitter    Skip Twitter crawl (also skips artists)
 *   --no-artists    Skip artist account crawl
 */

import { chromium } from "playwright";
import {
  readFileSync, writeFileSync, existsSync,
} from "fs";
import { resolve, join, dirname } from "path";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

// ── Config ───────────────────────────────────────────────────────────────────

const MEME_REGISTRY_PATH = resolve(PROJECT_ROOT, "data/midevils/meme_registry.json");
const TOP_TWEETS_PATH = resolve(PROJECT_ROOT, "data/midevils/top_tweets/top_tweets_registry.json");
const ARTIST_TWEETS_PATH = resolve(PROJECT_ROOT, "data/midevils/top_tweets/artist_tweets_registry.json");
const DISCORD_REGISTRY_PATH = resolve(PROJECT_ROOT, "data/midevils/discord_registry.json");

const DRY_RUN = process.argv.includes("--dry-run");
const NO_PUSH = process.argv.includes("--no-push");
const NO_DISCORD = process.argv.includes("--no-discord");
const NO_TWITTER = process.argv.includes("--no-twitter");
const NO_ARTISTS = process.argv.includes("--no-artists");

const VIEWPORT = { width: 1280, height: 900 };
const SCROLL_WAIT = 2500;
const SCROLL_ROUNDS = 8;

// MidEvils project started Aug 2025 — skip anything older
const TIMELINE_START = new Date("2025-08-01T00:00:00Z");

const ARTIST_ACCOUNTS = [
  { handle: "sircandyapple", username: "sircandyapple" },
  { handle: "jonnydegods",   username: "jonnydegods"   },
];

// ── Discord config ───────────────────────────────────────────────────────────

const DISCORD_SERVER_ID = "1405319351006924800";
const DISCORD_CHANNELS = [
  { name: "twitter-raids",  id: "1418109063845117982" },
  { name: "alpha-chat",     id: "1251026623864635433" },
  { name: "peasant-chat",   id: "1405319351854301237" },
  { name: "flex-chat",      id: "1448172693223379109" },
  { name: "midevils-bst",   id: "1408632599441834248" },
  { name: "events",         id: "1417838150016958474" },
];

const DISCORD_SCROLL_ROUNDS = 15;
const DISCORD_SCROLL_WAIT = 2000;

// ── Snowflake ID → date (works for both Twitter and Discord) ─────────────────

const TWITTER_EPOCH = 1288834974657n;
const DISCORD_EPOCH = 1420070400000n;

function tweetIdToDate(idStr) {
  try {
    const ms = Number(BigInt(idStr) >> 22n) + Number(TWITTER_EPOCH);
    return new Date(ms);
  } catch {
    return null;
  }
}

function discordSnowflakeToDate(idStr) {
  try {
    const ms = Number(BigInt(idStr) >> 22n) + Number(DISCORD_EPOCH);
    return new Date(ms);
  } catch {
    return null;
  }
}

function tweetIdToDateStr(idStr) {
  const d = tweetIdToDate(idStr);
  return d ? d.toISOString().split("T")[0] : null;
}

function tweetIdToISO(idStr) {
  const d = tweetIdToDate(idStr);
  return d ? d.toISOString() : null;
}

// ── Browser profile setup ────────────────────────────────────────────────────

// Discord: persistent Playwright profile (Discord doesn't block automated logins).
const DISCORD_PROFILE_DIR = resolve(PROJECT_ROOT, ".playwright-discord-profile");

function ensureProfile(dir) {
  const isNew = !existsSync(dir);
  if (isNew) {
    execSync(`mkdir -p "${dir}"`);
  }
  return isNew;
}

// ── Chrome CDP launcher (macOS) ─────────────────────────────────────────────
//
// Launches the real Google Chrome with --remote-debugging-port so Playwright
// can connect via CDP. This gives us the actual Chrome profile with real
// cookies and session — no extraction, no fake profiles, no Playwright login.
// Chrome must not already be running (profile is locked to one instance).

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CDP_PORT = 9222;

function isChromeRunning() {
  try {
    const out = execSync("pgrep -x 'Google Chrome'", { encoding: "utf8" });
    return out.trim().length > 0;
  } catch {
    return false; // pgrep exit code 1 = no match = not running
  }
}

async function launchChromeForTwitter() {
  if (isChromeRunning()) {
    console.error("  ⚠ Chrome is currently running.");
    console.error("  Please close Chrome and re-run. (Chrome locks its profile to one instance.)");
    return null;
  }

  // Chrome refuses --remote-debugging-port with its default data directory.
  // Workaround: create a wrapper dir with a symlink to the real profile so
  // Chrome sees a "non-default" path but reads the same profile data.
  const realDataDir = resolve(process.env.HOME, "Library/Application Support/Google/Chrome");
  const tmpDataDir = resolve(PROJECT_ROOT, ".chrome-cdp-wrapper");
  execSync(`rm -rf "${tmpDataDir}"`);
  execSync(`mkdir -p "${tmpDataDir}"`);
  execSync(`ln -sf "${realDataDir}/Default" "${tmpDataDir}/Default"`);
  try { execSync(`cp "${realDataDir}/Local State" "${tmpDataDir}/Local State"`); } catch {}

  console.log("  launching Chrome with remote debugging...");
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  // Log Chrome stderr so we can debug launch failures
  let chromeStderr = "";
  chrome.stderr.on("data", (d) => { chromeStderr += d.toString(); });
  chrome.on("exit", (code) => {
    if (code) console.error(`  Chrome exited with code ${code}`);
  });

  // Wait for Chrome to be ready (poll the debug endpoint via curl)
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      execSync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${CDP_PORT}/json/version`, {
        encoding: "utf8", timeout: 3000,
      });
      ready = true;
      break;
    } catch {}
    if (i === 5) console.log("  still waiting for Chrome...");
  }

  if (!ready) {
    console.error("  ⚠ Chrome did not start in time.");
    if (chromeStderr) console.error("  Chrome stderr:", chromeStderr.slice(0, 500));
    try { chrome.kill(); } catch {}
    return null;
  }

  console.log("  connecting via CDP...");
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  return { browser, chromeProcess: chrome };
}

// ── Scrape a Twitter/X media tab ─────────────────────────────────────────────

// Wait until at least one /status/ link appears, OR a hard "no tweets" / error
// signal shows up. Returns the link count we observed (0 only if we gave up).
async function waitForMediaTabReady(page, maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const state = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/status/"]');
      const body = document.body?.innerText || "";
      // Hard error signals — don't keep waiting
      const errorMatch = /Something went wrong|Try again|Retry|Rate limit|Welcome to X|Sign in to X/i.exec(body);
      // "No results" / empty media tab signal
      const emptyMatch = /These posts are protected|hasn['’]t posted|This account doesn['’]t exist/i.exec(body);
      return {
        linkCount: links.length,
        error: errorMatch?.[0] || null,
        empty: emptyMatch?.[0] || null,
      };
    }).catch(() => ({ linkCount: 0, error: null, empty: null }));

    if (state.linkCount > 0) return { ok: true, linkCount: state.linkCount, reason: null };
    if (state.empty) return { ok: true, linkCount: 0, reason: `empty: ${state.empty}` };
    if (state.error) return { ok: false, linkCount: 0, reason: `error: ${state.error}` };
    await page.waitForTimeout(1000);
  }
  return { ok: false, linkCount: 0, reason: "timeout (no tweets, no error)" };
}

async function scrapeMediaTab(page, handle) {
  const url = `https://x.com/${handle}/media`;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`  navigating to ${url}${attempt > 1 ? ` (attempt ${attempt}/${MAX_ATTEMPTS})` : ""}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (e) {
      console.warn(`  ⚠ navigation failed: ${e.message}`);
      await page.waitForTimeout(5000);
      continue;
    }

    const ready = await waitForMediaTabReady(page, 20000);
    if (ready.linkCount > 0) {
      console.log(`  media tab ready (${ready.linkCount} initial links)`);
      break;
    }
    if (ready.ok && ready.linkCount === 0) {
      // Genuinely empty — no point retrying
      console.log(`  media tab is empty: ${ready.reason}`);
      return new Set();
    }
    // Failed (error or timeout) — back off and retry
    console.warn(`  ⚠ media tab not ready: ${ready.reason}`);
    if (attempt < MAX_ATTEMPTS) {
      const backoffMs = 5000 * attempt; // 5s, 10s
      console.log(`  backing off ${backoffMs}ms before retry`);
      await page.waitForTimeout(backoffMs);
    } else {
      console.warn(`  ⚠ giving up on @${handle} media tab after ${MAX_ATTEMPTS} attempts`);
      return new Set();
    }
  }

  const seen = new Set();
  let stalledRounds = 0;

  for (let round = 0; round < SCROLL_ROUNDS; round++) {
    const beforeSize = seen.size;
    const links = await page.$$eval(
      'a[href*="/status/"]',
      (els) => els.map((a) => a.href).filter((h) => /\/status\/\d+/.test(h))
    );

    for (const link of links) {
      const match = link.match(/\/status\/(\d+)/);
      if (match) seen.add(match[1]);
    }

    console.log(`  round ${round + 1}/${SCROLL_ROUNDS}: ${seen.size} unique tweets so far`);

    // If we made it to round 1 with 0 tweets, the load failed silently
    if (round === 0 && seen.size === 0) {
      console.warn(`  ⚠ first scroll round saw 0 tweets — page may have failed to load`);
    }

    if (seen.size === beforeSize) stalledRounds++; else stalledRounds = 0;
    if (stalledRounds >= 3 && seen.size > 0) {
      console.log(`  no new tweets for 3 rounds — stopping early at ${seen.size}`);
      break;
    }

    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await page.waitForTimeout(SCROLL_WAIT);
  }

  return seen;
}

// ── Extract media URLs from a tweet page ─────────────────────────────────────

async function extractTweetMedia(page, tweetId, handle) {
  const url = `https://x.com/${handle}/status/${tweetId}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);

    const images = await page.$$eval(
      'img[src*="pbs.twimg.com/media"]',
      (els) => els.map((img) => {
        const src = img.src;
        const base = src.split("?")[0];
        const mediaId = base.split("/").pop();
        return { src: `${base}?format=jpg&name=large`, mediaId };
      })
    );

    const unique = [];
    const seenIds = new Set();
    for (const img of images) {
      if (!seenIds.has(img.mediaId)) {
        seenIds.add(img.mediaId);
        unique.push(img);
      }
    }

    return unique;
  } catch (e) {
    console.warn(`  ⚠ failed to extract media from ${tweetId}: ${e.message}`);
    return [];
  }
}

// ── Main crawl: @MidEvilsNFT Twitter ────────────────────────────────────────

async function crawlMidEvils(context) {
  console.log("\n── Crawling @MidEvilsNFT media tab ──");
  const page = await context.newPage();

  const existing = JSON.parse(readFileSync(MEME_REGISTRY_PATH, "utf8"));
  const existingTweetIds = new Set(existing.map((e) => e.tweet_id));

  const tweetIds = await scrapeMediaTab(page, "MidEvilsNFT");
  // Filter: skip existing + skip tweets older than project start (Aug 2025)
  const newIds = [...tweetIds].filter((id) => {
    if (existingTweetIds.has(id)) return false;
    const dt = tweetIdToDate(id);
    if (dt && dt < TIMELINE_START) return false;
    return true;
  });

  console.log(`  found ${tweetIds.size} total, ${newIds.length} new (after date filter)`);

  if (newIds.length === 0) {
    console.log("  no new tweets, skipping");
    await page.close();
    return 0;
  }

  const newEntries = [];
  for (const id of newIds) {
    const dateStr = tweetIdToDateStr(id);
    const month = dateStr ? dateStr.slice(0, 7) : "unknown";
    const media = await extractTweetMedia(page, id, "MidEvilsNFT");

    for (const img of media) {
      newEntries.push({
        filename: `${dateStr}_MidEvilsNFT_${img.mediaId}.jpg`,
        month,
        date: dateStr,
        username: "MidEvilsNFT",
        tweet_id: id,
        tweet_url: `https://x.com/MidEvilsNFT/status/${id}`,
        media_id: img.mediaId,
        img_url: img.src,
        downloaded: false,
        likes: 0, reposts: 0, replies: 0, views: 0, score: 0.0,
      });
    }
  }

  console.log(`  ${newEntries.length} new images from ${newIds.length} tweets`);

  if (!DRY_RUN && newEntries.length > 0) {
    const merged = [...existing, ...newEntries];
    merged.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    writeFileSync(MEME_REGISTRY_PATH, JSON.stringify(merged, null, 2) + "\n");
    console.log(`  ✅ wrote ${merged.length} entries to meme_registry.json`);
  }

  await page.close();
  return newEntries.length;
}

// ── Sync top_tweets_registry from meme_registry (no extra scrape needed) ─────

async function updateOfficialFromMemeRegistry() {
  console.log("\n── Syncing official tweets from meme registry ──");

  const memes = JSON.parse(readFileSync(MEME_REGISTRY_PATH, "utf8"));
  const existing = JSON.parse(readFileSync(TOP_TWEETS_PATH, "utf8"));
  const existingIds = new Set(existing.map((e) => e.id));

  // Group meme entries by tweet_id to build official tweet records
  const byTweet = new Map();
  for (const m of memes) {
    if (!m.tweet_id || m.username !== "MidEvilsNFT") continue;
    if (existingIds.has(m.tweet_id)) continue;
    if (!byTweet.has(m.tweet_id)) byTweet.set(m.tweet_id, []);
    byTweet.get(m.tweet_id).push(m);
  }

  const newEntries = [];
  for (const [id, items] of byTweet) {
    const images = items.map((m) => m.img_url).filter(Boolean);
    newEntries.push({
      id,
      url: `https://x.com/MidEvilsNFT/status/${id}`,
      username: "MidEvilsNFT",
      text: "",
      date: tweetIdToISO(id) ?? "",
      likes: 0, views: 0, reposts: 0, replies: 0,
      images,
    });
  }

  console.log(`  ${newEntries.length} new official tweets to sync`);

  if (!DRY_RUN && newEntries.length > 0) {
    const merged = [...existing, ...newEntries];
    merged.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    writeFileSync(TOP_TWEETS_PATH, JSON.stringify(merged, null, 2) + "\n");
    console.log(`  ✅ wrote ${merged.length} entries to top_tweets_registry.json`);
  }
}

// ── Discord channel crawl (API-based) ────────────────────────────────────────
//
// Uses Discord's internal API via fetch() from inside the browser context.
// Since we're on discord.com with a logged-in session, the requests are
// authenticated automatically. This is vastly faster than scroll-based
// scraping — 100 messages per request instead of ~20 per scroll.

const DISCORD_API_BATCH = 100; // max per request
const DISCORD_API_DELAY = 1500; // ms between requests (rate limit safety)
const DISCORD_MAX_PAGES = 20; // max pages per channel (2000 messages)

async function crawlDiscord(context) {
  console.log("\n── Crawling Discord channels (API mode) ──");
  const page = await context.newPage();

  const existing = JSON.parse(readFileSync(DISCORD_REGISTRY_PATH, "utf8"));
  const existingMsgIds = new Set(existing.map((e) => e.msgId));

  // Find latest message ID per channel so we only fetch newer messages
  const latestPerChannel = {};
  for (const e of existing) {
    const ch = e.channel;
    const id = e.msgId;
    if (!latestPerChannel[ch] || BigInt(id) > BigInt(latestPerChannel[ch])) {
      latestPerChannel[ch] = id;
    }
  }

  let latestTimestamp = "";
  for (const e of existing) {
    if ((e.timestamp ?? "") > latestTimestamp) latestTimestamp = e.timestamp;
  }
  console.log(`  existing: ${existing.length} entries, latest: ${latestTimestamp.slice(0, 10)}`);

  // Navigate to Discord and extract auth token
  await page.goto(`https://discord.com/channels/${DISCORD_SERVER_ID}/${DISCORD_CHANNELS[0].id}`, {
    waitUntil: "domcontentloaded", timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Extract the user token from Discord's webpack modules
  const authToken = await page.evaluate(() => {
    // Method 1: webpackChunkdiscord_app — find getToken in all modules
    try {
      const wp = (window.webpackChunkdiscord_app || []);
      let token = null;
      wp.push([["__token_extract__"], {}, (req) => {
        for (const id of Object.keys(req.c || {})) {
          const mod = req.c[id]?.exports;
          if (!mod) continue;
          // Check every export and sub-export for getToken
          const candidates = [mod, mod.default, mod.Z, mod.ZP];
          for (const obj of candidates) {
            if (!obj) continue;
            if (typeof obj.getToken === "function") {
              const t = obj.getToken();
              if (typeof t === "string" && t.length > 20) { token = t; break; }
            }
            // Check all keys on the object
            if (typeof obj === "object") {
              for (const key of Object.keys(obj)) {
                const sub = obj[key];
                if (sub && typeof sub.getToken === "function") {
                  const t = sub.getToken();
                  if (typeof t === "string" && t.length > 20) { token = t; break; }
                }
              }
            }
            if (token) break;
          }
          if (token) break;
        }
      }]);
      if (token) return token;
    } catch {}

    // Method 2: intercept from localStorage via iframe
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      const raw = iframe.contentWindow?.localStorage?.getItem("token");
      iframe.remove();
      if (raw) {
        const cleaned = raw.replace(/^"|"$/g, "");
        if (cleaned.length > 20) return cleaned;
      }
    } catch {}

    return null;
  });

  if (!authToken) {
    console.error("  ⚠ Could not extract Discord auth token. Make sure you're logged in.");
    await page.close();
    return 0;
  }
  const token = String(authToken);
  console.log(`  auth token acquired (${token.slice(0, 10)}...)`);

  let totalNew = 0;
  const allNewEntries = [];

  for (const channel of DISCORD_CHANNELS) {
    console.log(`\n  #${channel.name}`);

    try {
      const afterId = latestPerChannel[channel.name] || null;
      let fetchedTotal = 0;
      let channelImages = 0;
      let beforeId = null; // paginate backwards from newest
      let reachedExisting = false;

      for (let pageNum = 0; pageNum < DISCORD_MAX_PAGES; pageNum++) {
        // Build API URL — fetch messages, paginating backwards
        let apiUrl = `https://discord.com/api/v9/channels/${channel.id}/messages?limit=${DISCORD_API_BATCH}`;
        if (beforeId) apiUrl += `&before=${beforeId}`;

        const batch = await page.evaluate(async ({ url, token }) => {
          try {
            const resp = await fetch(url, {
              headers: { "Authorization": token },
            });
            if (!resp.ok) return { error: resp.status, text: await resp.text() };
            return { messages: await resp.json() };
          } catch (e) {
            return { error: e.message };
          }
        }, { url: apiUrl, token });

        if (batch.error) {
          console.warn(`    ⚠ API error: ${batch.error}`);
          break;
        }

        const messages = batch.messages || [];
        if (messages.length === 0) break;
        fetchedTotal += messages.length;

        // Update beforeId for next page (messages come newest-first)
        beforeId = messages[messages.length - 1].id;

        let pageImages = 0;
        for (const msg of messages) {
          // Stop if we've reached messages we already have
          if (existingMsgIds.has(msg.id)) {
            reachedExisting = true;
            continue;
          }

          const images = [];

          // Attachments (directly uploaded files)
          for (const att of (msg.attachments || [])) {
            if (!att.content_type?.startsWith("image/")) continue;
            images.push({
              type: "attachment",
              url: att.proxy_url || att.url,
              filename: att.filename,
            });
          }

          // Embeds (Twitter previews, linked images, etc.)
          // Only capture embed.image (full content image), NOT embed.thumbnail
          // (thumbnails are just profile pics, X logos, and tiny icons)
          for (const embed of (msg.embeds || [])) {
            if (embed.image?.proxy_url || embed.image?.url) {
              images.push({
                type: "embed",
                url: embed.image.proxy_url || embed.image.url,
                filename: null,
                embedType: embed.type || "rich",
              });
            }
          }

          if (images.length === 0) continue;

          // Extract tweet URL if present
          let tweetUrl = "";
          if (msg.content) {
            const tweetMatch = msg.content.match(/https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/);
            if (tweetMatch) tweetUrl = tweetMatch[0];
          }
          for (const embed of (msg.embeds || [])) {
            if (!tweetUrl && embed.url && /\/(x\.com|twitter\.com)\/\w+\/status\/\d+/.test(embed.url)) {
              tweetUrl = embed.url;
            }
          }

          const timestamp = msg.timestamp || "";
          const month = timestamp ? timestamp.slice(0, 7) : "unknown";

          for (const img of images) {
            let urlFilename = img.filename || "image.jpg";
            if (!img.filename) {
              try { urlFilename = new URL(img.url).pathname.split("/").pop() || "image.jpg"; } catch {}
            }
            const filenameLocal = `${channel.name}_${msg.id}_${urlFilename}`;

            allNewEntries.push({
              source: "discord",
              channel: channel.name,
              msgId: msg.id,
              author: msg.author?.username || "user",
              timestamp,
              month,
              type: img.type,
              embedType: img.embedType || "",
              url: img.url,
              tweetUrl,
              filename_local: filenameLocal,
              downloaded: false,
            });
            pageImages++;
            channelImages++;
          }
          existingMsgIds.add(msg.id);
        }

        console.log(`    page ${pageNum + 1}: ${messages.length} msgs, +${pageImages} images`);

        // Stop if we've reached messages we already have
        if (reachedExisting) {
          console.log(`    reached existing entries, stopping`);
          break;
        }

        // Rate limit pause
        await page.waitForTimeout(DISCORD_API_DELAY);
      }

      console.log(`  #${channel.name}: ${channelImages} new images (${fetchedTotal} msgs scanned)`);
      totalNew += channelImages;

    } catch (e) {
      console.warn(`  ⚠ failed to crawl #${channel.name}: ${e.message}`);
    }
  }

  if (!DRY_RUN && allNewEntries.length > 0) {
    const merged = [...existing, ...allNewEntries];
    merged.sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));
    writeFileSync(DISCORD_REGISTRY_PATH, JSON.stringify(merged, null, 2) + "\n");
    console.log(`\n  ✅ wrote ${merged.length} entries to discord_registry.json (+${allNewEntries.length})`);
  }

  await page.close();
  return totalNew;
}

// ── Rebuild timeline + git push ──────────────────────────────────────────────

function rebuildAndDeploy(changeCount) {
  if (changeCount === 0) {
    console.log("\n── No changes, skipping rebuild ──");
    return;
  }

  if (DRY_RUN) {
    console.log("\n── DRY RUN: would rebuild timeline and push ──");
    return;
  }

  console.log("\n── Rebuilding timeline ──");
  try {
    execSync("node scripts/build-timeline.mjs", {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
  } catch (e) {
    console.error("  ⚠ build-timeline failed:", e.message);
    return;
  }

  if (NO_PUSH) {
    console.log("  --no-push flag set, skipping git");
    return;
  }

  console.log("\n── Committing and pushing ──");
  try {
    execSync('git add data/midevils/', { cwd: PROJECT_ROOT, stdio: "inherit" });
    const msg = `scrolls: +${changeCount} items [automated]`;
    execSync(`git commit -m "${msg}"`, { cwd: PROJECT_ROOT, stdio: "inherit" });
    // Use the stash/rebase pattern in case Vercel pushed a deploy commit
    execSync(
      'git stash && git pull --rebase origin main && git stash pop ; git push origin main',
      { cwd: PROJECT_ROOT, stdio: "inherit" }
    );
    console.log("  ✅ pushed — Vercel will auto-deploy");
  } catch (e) {
    console.error("  ⚠ git push failed:", e.message);
    console.error("  run manually: cd ~/common/web && git add data/midevils/ && git commit -m 'scrolls update' && git push");
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Scrolls Update — ${new Date().toISOString()}`);
  console.log(`  dry-run: ${DRY_RUN}, no-push: ${NO_PUSH}`);
  console.log(`  twitter: ${!NO_TWITTER}, discord: ${!NO_DISCORD}, artists: ${!NO_ARTISTS}`);
  console.log(`${"=".repeat(60)}`);

  let totalNew = 0;

  // ── Twitter + Artist crawl (single Chrome CDP session) ──
  if (!NO_TWITTER) {
    console.log("\n── Setting up Twitter crawl (Chrome CDP) ──");
    const cdp = await launchChromeForTwitter();

    if (!cdp) {
      console.warn("  Skipping Twitter crawl.");
    } else {
      try {
        const contexts = cdp.browser.contexts();
        const twitterCtx = contexts[0];

        // Check if we're logged into X — if not, prompt for manual login
        const checkPage = await twitterCtx.newPage();
        await checkPage.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 30000 });
        await checkPage.waitForTimeout(3000);

        const isLoggedIn = await checkPage.evaluate(() => {
          return !window.location.href.includes("/login")
            && !window.location.href.includes("/i/flow")
            && !document.querySelector('[data-testid="loginButton"]');
        });

        if (!isLoggedIn) {
          console.log("\n══════════════════════════════════════════════════════════════");
          console.log("  NOT LOGGED IN: Please sign into X in the Chrome window.");
          console.log("  Once you see your feed, come back here and press Enter.");
          console.log("══════════════════════════════════════════════════════════════\n");

          await checkPage.goto("https://x.com", { waitUntil: "domcontentloaded" });
          await new Promise((resolve) => {
            process.stdin.setRawMode?.(false);
            process.stdin.resume();
            process.stdin.once("data", resolve);
          });

          await checkPage.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 30000 });
          await checkPage.waitForTimeout(3000);
          const nowLoggedIn = await checkPage.evaluate(() =>
            !window.location.href.includes("/login") && !window.location.href.includes("/i/flow")
          );
          if (!nowLoggedIn) {
            console.error("  ⚠ Still not logged in. Skipping Twitter crawl.");
            await checkPage.close();
            throw new Error("Twitter login failed");
          }
          console.log("  ✅ Logged in to X!");
        } else {
          console.log("  ✅ Already logged in to X");
        }
        await checkPage.close();

        // ── @MidEvilsNFT media + official tweets (single scrape) ──
        totalNew += await crawlMidEvils(twitterCtx);

        // Update official tweets registry using the same tweet IDs we already found
        // (avoids re-scraping the same media tab which X rate-limits)
        await updateOfficialFromMemeRegistry(twitterCtx);

        // ── Artist accounts (same session, with delay to avoid rate limits) ──
        if (!NO_ARTISTS) {
          console.log("\n── Crawling artist accounts ──");
          await new Promise((r) => setTimeout(r, 5000)); // 5s cooldown

          let artistRegistry = JSON.parse(readFileSync(ARTIST_TWEETS_PATH, "utf8"));
          const existingIds = new Set(artistRegistry.map((e) => e.tweet_id).filter(Boolean));

          for (const artist of ARTIST_ACCOUNTS) {
            console.log(`\n  @${artist.handle}:`);
            await new Promise((r) => setTimeout(r, 3000)); // pause between artists

            let page;
            try {
              page = await twitterCtx.newPage();
            } catch (e) {
              console.warn(`  ⚠ browser closed, stopping artist crawl`);
              break;
            }

            const tweetIds = await scrapeMediaTab(page, artist.handle);
            // Filter: skip existing + skip tweets older than project start
            const newIds = [...tweetIds].filter((id) => {
              if (existingIds.has(id)) return false;
              const dt = tweetIdToDate(id);
              if (dt && dt < TIMELINE_START) return false;
              return true;
            });
            console.log(`    ${tweetIds.size} total, ${newIds.length} new (after date filter)`);

            const artistEntries = [];
            for (const id of newIds) {
              try {
                const media = await extractTweetMedia(page, id, artist.handle);
                const images = media.map((m) => m.src);
                const dateISO = tweetIdToISO(id) ?? "";

                artistEntries.push({
                  tweet_id: id,
                  url: `https://x.com/${artist.handle}/status/${id}`,
                  username: artist.username,
                  text: "",
                  date: dateISO,
                  likes: 0, views: 0, reposts: 0, replies: 0,
                  images,
                });
                existingIds.add(id);
              } catch (e) {
                console.warn(`  ⚠ browser issue at ${id}, saving progress`);
                break; // save what we have so far
              }
            }

            // Save after each artist (crash-resilient)
            if (!DRY_RUN && artistEntries.length > 0) {
              artistRegistry = [...artistRegistry, ...artistEntries];
              artistRegistry.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
              writeFileSync(ARTIST_TWEETS_PATH, JSON.stringify(artistRegistry, null, 2) + "\n");
              console.log(`    ✅ saved +${artistEntries.length} entries (${artistRegistry.length} total)`);
              totalNew += artistEntries.length;
            }

            try { await page.close(); } catch {}
          }
        }
      } catch (e) {
        console.error("Twitter crawl error:", e);
      } finally {
        await cdp.browser.close();
        try { cdp.chromeProcess.kill(); } catch {}
        const wrapper = resolve(PROJECT_ROOT, ".chrome-cdp-wrapper");
        try { execSync(`rm -rf "${wrapper}"`, { stdio: "ignore" }); } catch {}
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  // ── Discord crawl (uses persistent profile — survives between runs) ──
  if (!NO_DISCORD) {
    const isFirstRun = ensureProfile(DISCORD_PROFILE_DIR);

    if (isFirstRun) {
      console.log("\n══════════════════════════════════════════════════════════════");
      console.log("  FIRST RUN: Discord profile needs setup.");
      console.log("  A browser will open — please log into Discord.");
      console.log("  Once logged in and you can see your channels,");
      console.log("  close the browser and re-run this script.");
      console.log("══════════════════════════════════════════════════════════════\n");
    }

    const discordCtx = await chromium.launchPersistentContext(DISCORD_PROFILE_DIR, {
      channel: "chrome",
      headless: false,
      viewport: VIEWPORT,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });

    try {
      if (isFirstRun) {
        // Navigate to Discord so the user can log in
        const setupPage = await discordCtx.newPage();
        await setupPage.goto("https://discord.com/login", { waitUntil: "domcontentloaded" });
        console.log("  Waiting for you to log in... (close the browser when done)");
        // Wait for the browser to be closed by the user
        await new Promise((resolve) => discordCtx.on("close", resolve));
        console.log("  Discord profile saved. Re-run the script to start crawling.");
      } else {
        totalNew += await crawlDiscord(discordCtx);
      }
    } catch (e) {
      console.error("Discord crawl error:", e);
    } finally {
      try { await discordCtx.close(); } catch {}
    }
  }

  rebuildAndDeploy(totalNew);

  console.log(`\n✅ Done. ${totalNew} new items.`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
