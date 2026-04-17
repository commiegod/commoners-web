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

const DISCORD_SCROLL_ROUNDS = 6;
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

function makeTempProfile() {
  const tmp = mkdtempSync(join(tmpdir(), "scrolls-chrome-"));
  console.log(`  temp profile: ${tmp}`);
  execSync(`cp -r "${CHROME_DEFAULT}" "${tmp}/Default"`, { stdio: "inherit" });
  return tmp;
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

// ── Discord channel crawl ────────────────────────────────────────────────────

async function crawlDiscord(context) {
  console.log("\n── Crawling Discord channels ──");
  const page = await context.newPage();

  // Load existing registry and build a set of known message IDs
  const existing = JSON.parse(readFileSync(DISCORD_REGISTRY_PATH, "utf8"));
  const existingMsgIds = new Set(existing.map((e) => e.msgId));

  // Find the latest timestamp so we know when to stop scrolling
  let latestTimestamp = "";
  for (const e of existing) {
    if ((e.timestamp ?? "") > latestTimestamp) latestTimestamp = e.timestamp;
  }
  console.log(`  existing: ${existing.length} entries, latest: ${latestTimestamp.slice(0, 10)}`);

  let totalNew = 0;
  const allNewEntries = [];

  for (const channel of DISCORD_CHANNELS) {
    const channelUrl = `https://discord.com/channels/${DISCORD_SERVER_ID}/${channel.id}`;
    console.log(`\n  #${channel.name} → ${channelUrl}`);

    try {
      await page.goto(channelUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Wait for messages to load
      await page.waitForTimeout(4000);

      const channelEntries = [];

      for (let round = 0; round < DISCORD_SCROLL_ROUNDS; round++) {
        // Extract messages with images/embeds
        const messages = await page.evaluate(() => {
          const results = [];

          // Find all message list items
          const msgEls = document.querySelectorAll('[id^="chat-messages-"]');

          for (const msgEl of msgEls) {
            // Extract message ID from the element ID
            const idMatch = msgEl.id.match(/chat-messages-(\d+)/);
            if (!idMatch) continue;
            const msgId = idMatch[1];

            // Find images in this message
            const images = [];

            // Direct attachment images
            const attachImgs = msgEl.querySelectorAll(
              '[class*="imageWrapper"] img[src*="cdn.discordapp.com"], ' +
              '[class*="imageWrapper"] img[src*="media.discordapp.net"]'
            );
            for (const img of attachImgs) {
              const src = img.src || "";
              if (src && !src.includes("emoji") && !src.includes("avatar")) {
                images.push({ type: "attachment", url: src });
              }
            }

            // Embedded images (e.g. Twitter embeds with preview images)
            const embedImgs = msgEl.querySelectorAll(
              '[class*="embed"] img[src*="pbs.twimg.com"], ' +
              '[class*="embed"] img[src*="cdn.discordapp.com"]'
            );
            for (const img of embedImgs) {
              const src = img.src || "";
              if (src && !src.includes("emoji") && !src.includes("avatar")) {
                images.push({ type: "embed", url: src });
              }
            }

            // Also check for Twitter embed links
            const tweetLinks = msgEl.querySelectorAll('a[href*="x.com/"], a[href*="twitter.com/"]');
            let tweetUrl = "";
            for (const a of tweetLinks) {
              if (/\/status\/\d+/.test(a.href)) {
                tweetUrl = a.href;
                break;
              }
            }

            if (images.length > 0) {
              results.push({ msgId, images, tweetUrl });
            }
          }

          return results;
        });

        let roundNew = 0;
        for (const msg of messages) {
          if (existingMsgIds.has(msg.msgId)) continue;
          existingMsgIds.add(msg.msgId); // prevent dupes within this run

          const timestamp = discordSnowflakeToDate(msg.msgId);
          const ts = timestamp ? timestamp.toISOString() : "";
          const month = ts ? ts.slice(0, 7) : "unknown";

          for (const img of msg.images) {
            // Build a filename from the URL
            const urlPath = new URL(img.url).pathname;
            const urlFilename = urlPath.split("/").pop() || "image.jpg";
            const filenameLocal = `${channel.name}_${msg.msgId}_${urlFilename}`;

            channelEntries.push({
              source: "discord",
              channel: channel.name,
              msgId: msg.msgId,
              author: "user",
              timestamp: ts,
              month,
              type: img.type,
              url: img.url,
              tweetUrl: msg.tweetUrl || "",
              filename_local: filenameLocal,
              downloaded: false,
            });
            roundNew++;
          }
        }

        console.log(`    round ${round + 1}/${DISCORD_SCROLL_ROUNDS}: +${roundNew} images this round`);

        // Scroll up to load older messages
        await page.evaluate(() => {
          const scroller = document.querySelector('[class*="scroller"][data-list-id="chat-messages"]')
            || document.querySelector('[class*="messagesWrapper"] [class*="scroller"]');
          if (scroller) scroller.scrollTop = 0;
        });
        await page.waitForTimeout(DISCORD_SCROLL_WAIT);
      }

      console.log(`  #${channel.name}: ${channelEntries.length} new images`);
      allNewEntries.push(...channelEntries);
      totalNew += channelEntries.length;

    } catch (e) {
      console.warn(`  ⚠ failed to crawl #${channel.name}: ${e.message}`);
    }
  }

  if (!DRY_RUN && allNewEntries.length > 0) {
    const merged = [...existing, ...allNewEntries];
    // Sort by timestamp
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

  if (!existsSync(CHROME_DEFAULT)) {
    console.error("Chrome Default profile not found at:", CHROME_DEFAULT);
    process.exit(1);
  }

  const profileDir = makeTempProfile();

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",  // use system Chrome, not bundled Chromium
    headless: false,    // X and Discord require a visible browser
    viewport: VIEWPORT,
    args: ["--no-sandbox"],
  });

  let totalNew = 0;

  try {
    if (!NO_TWITTER) {
      totalNew += await crawlMidEvils(context);
      totalNew += await crawlOfficialTweets(context);
    }

    if (!NO_DISCORD) {
      totalNew += await crawlDiscord(context);
    }

    if (CRAWL_ARTISTS) {
      console.log("\n── Artist crawl not yet implemented in this script ──");
      console.log("  (use --artists when ready)");
    }
  } catch (e) {
    console.error("Crawl error:", e);
  } finally {
    await context.close();
    // Clean up temp profile
    try { execSync(`rm -rf "${profileDir}"`); } catch {}
  }

  rebuildAndDeploy(totalNew);

  console.log(`\n✅ Done. ${totalNew} new items.`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
