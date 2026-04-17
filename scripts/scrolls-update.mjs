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
 *   --no-discord    Skip Discord crawl (Twitter only)
 *   --no-twitter    Skip Twitter crawl (Discord only)
 *   --artists       Also crawl artist accounts (slower)
 */

import { chromium } from "playwright";
import {
  readFileSync, writeFileSync, existsSync, mkdtempSync,
} from "fs";
import { resolve, join, dirname } from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

// ── Config ───────────────────────────────────────────────────────────────────

const MEME_REGISTRY_PATH = resolve(PROJECT_ROOT, "data/midevils/meme_registry.json");
const TOP_TWEETS_PATH = resolve(PROJECT_ROOT, "data/midevils/top_tweets/top_tweets_registry.json");
const ARTIST_TWEETS_PATH = resolve(PROJECT_ROOT, "data/midevils/top_tweets/artist_tweets_registry.json");
const DISCORD_REGISTRY_PATH = resolve(PROJECT_ROOT, "data/midevils/discord_registry.json");

const CHROME_DEFAULT = resolve(
  os.homedir(),
  "Library/Application Support/Google/Chrome/Default"
);

const DRY_RUN = process.argv.includes("--dry-run");
const NO_PUSH = process.argv.includes("--no-push");
const NO_DISCORD = process.argv.includes("--no-discord");
const NO_TWITTER = process.argv.includes("--no-twitter");
const CRAWL_ARTISTS = process.argv.includes("--artists");

const VIEWPORT = { width: 1280, height: 900 };
const SCROLL_WAIT = 2500;
const SCROLL_ROUNDS = 8;

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

// ── Chrome profile setup ─────────────────────────────────────────────────────

// Temp profile for Twitter (copied from Chrome Default — X sessions survive the copy)
function makeTempProfile() {
  const tmp = mkdtempSync(join(tmpdir(), "scrolls-chrome-"));
  console.log(`  temp profile: ${tmp}`);
  execSync(`cp -r "${CHROME_DEFAULT}" "${tmp}/Default"`, { stdio: "inherit" });
  return tmp;
}

// Persistent profile for Discord (Discord sessions don't survive profile copies,
// so we keep a dedicated Playwright profile that stays logged in between runs)
const DISCORD_PROFILE_DIR = resolve(PROJECT_ROOT, ".playwright-discord-profile");

function ensureDiscordProfile() {
  const isNew = !existsSync(DISCORD_PROFILE_DIR);
  if (isNew) {
    execSync(`mkdir -p "${DISCORD_PROFILE_DIR}"`);
  }
  return isNew;
}

// ── Scrape a Twitter/X media tab ─────────────────────────────────────────────

async function scrapeMediaTab(page, handle) {
  const url = `https://x.com/${handle}/media`;
  console.log(`  navigating to ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);

  const seen = new Set();

  for (let round = 0; round < SCROLL_ROUNDS; round++) {
    const links = await page.$$eval(
      'a[href*="/status/"]',
      (els) => els.map((a) => a.href).filter((h) => /\/status\/\d+/.test(h))
    );

    for (const link of links) {
      const match = link.match(/\/status\/(\d+)/);
      if (match) seen.add(match[1]);
    }

    console.log(`  round ${round + 1}/${SCROLL_ROUNDS}: ${seen.size} unique tweets so far`);

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
  const newIds = [...tweetIds].filter((id) => !existingTweetIds.has(id));

  console.log(`  found ${tweetIds.size} total, ${newIds.length} new`);

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

// ── Update top_tweets_registry with official tweets ──────────────────────────

async function crawlOfficialTweets(context) {
  console.log("\n── Crawling @MidEvilsNFT for official tweet metadata ──");
  const page = await context.newPage();

  const existing = JSON.parse(readFileSync(TOP_TWEETS_PATH, "utf8"));
  const existingIds = new Set(existing.map((e) => e.id));

  const tweetIds = await scrapeMediaTab(page, "MidEvilsNFT");
  const newIds = [...tweetIds].filter((id) => !existingIds.has(id));

  console.log(`  ${newIds.length} new official tweets to index`);

  if (newIds.length === 0) {
    await page.close();
    return 0;
  }

  const newEntries = [];
  for (const id of newIds) {
    const media = await extractTweetMedia(page, id, "MidEvilsNFT");
    const images = media.map((m) => m.src);

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

  if (!DRY_RUN && newEntries.length > 0) {
    const merged = [...existing, ...newEntries];
    merged.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    writeFileSync(TOP_TWEETS_PATH, JSON.stringify(merged, null, 2) + "\n");
    console.log(`  ✅ wrote ${merged.length} entries to top_tweets_registry.json`);
  }

  await page.close();
  return newEntries.length;
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
  console.log(`  twitter: ${!NO_TWITTER}, discord: ${!NO_DISCORD}, artists: ${CRAWL_ARTISTS}`);
  console.log(`${"=".repeat(60)}`);

  let totalNew = 0;

  // ── Twitter crawl (uses temp copy of Chrome Default profile) ──
  if (!NO_TWITTER) {
    if (!existsSync(CHROME_DEFAULT)) {
      console.error("Chrome Default profile not found at:", CHROME_DEFAULT);
      process.exit(1);
    }

    const profileDir = makeTempProfile();
    const twitterCtx = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless: false,
      viewport: VIEWPORT,
      args: ["--no-sandbox"],
    });

    try {
      totalNew += await crawlMidEvils(twitterCtx);
      totalNew += await crawlOfficialTweets(twitterCtx);
    } catch (e) {
      console.error("Twitter crawl error:", e);
    } finally {
      await twitterCtx.close();
      try { execSync(`rm -rf "${profileDir}"`); } catch {}
    }
  }

  // ── Discord crawl (uses persistent profile — survives between runs) ──
  if (!NO_DISCORD) {
    const isFirstRun = ensureDiscordProfile();

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
      args: ["--no-sandbox"],
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

  if (CRAWL_ARTISTS) {
    console.log("\n── Artist crawl not yet implemented in this script ──");
  }

  rebuildAndDeploy(totalNew);

  console.log(`\n✅ Done. ${totalNew} new items.`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
