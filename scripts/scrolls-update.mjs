#!/usr/bin/env node
/**
 * scrolls-update.mjs
 *
 * Single local script that replaces all 4 Claude scheduled tasks.
 * Crawls @MidEvilsNFT media tab, updates meme_registry.json,
 * rebuilds the timeline, and pushes to trigger Vercel deploy.
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

const CHROME_DEFAULT = resolve(
  os.homedir(),
  "Library/Application Support/Google/Chrome/Default"
);

const DRY_RUN = process.argv.includes("--dry-run");
const NO_PUSH = process.argv.includes("--no-push");
const CRAWL_ARTISTS = process.argv.includes("--artists");

const VIEWPORT = { width: 1280, height: 900 };
const SCROLL_WAIT = 2500;
const SCROLL_ROUNDS = 8;

// ── Snowflake ID → date ──────────────────────────────────────────────────────

function tweetIdToDate(idStr) {
  try {
    const ms = Number(BigInt(idStr) >> 22n) + 1288834974657;
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
    // Extract tweet links from the media grid
    const links = await page.$$eval(
      'a[href*="/status/"]',
      (els) => els.map((a) => a.href).filter((h) => /\/status\/\d+/.test(h))
    );

    for (const link of links) {
      const match = link.match(/\/status\/(\d+)/);
      if (match) seen.add(match[1]);
    }

    // Also extract image URLs from the media grid
    const imgs = await page.$$eval(
      'img[src*="pbs.twimg.com/media"]',
      (els) => els.map((img) => ({
        src: img.src,
        // Try to find the parent tweet link
        tweetLink: img.closest('a[href*="/status/"]')?.href
          ?? img.closest('[data-testid]')?.querySelector('a[href*="/status/"]')?.href
          ?? "",
      }))
    );

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
        // Normalize to large format
        const base = src.split("?")[0];
        const mediaId = base.split("/").pop();
        return { src: `${base}?format=jpg&name=large`, mediaId };
      })
    );

    // Deduplicate by mediaId
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

// ── Main crawl: @MidEvilsNFT ────────────────────────────────────────────────

async function crawlMidEvils(context) {
  console.log("\n── Crawling @MidEvilsNFT media tab ──");
  const page = await context.newPage();

  // Load existing registry
  const existing = JSON.parse(readFileSync(MEME_REGISTRY_PATH, "utf8"));
  const existingTweetIds = new Set(existing.map((e) => e.tweet_id));

  // Scrape the media tab
  const tweetIds = await scrapeMediaTab(page, "MidEvilsNFT");
  const newIds = [...tweetIds].filter((id) => !existingTweetIds.has(id));

  console.log(`  found ${tweetIds.size} total, ${newIds.length} new`);

  if (newIds.length === 0) {
    console.log("  no new tweets, skipping");
    await page.close();
    return 0;
  }

  // For each new tweet, extract media
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
        likes: 0,
        reposts: 0,
        replies: 0,
        views: 0,
        score: 0.0,
      });
    }
  }

  console.log(`  ${newEntries.length} new images from ${newIds.length} tweets`);

  if (!DRY_RUN && newEntries.length > 0) {
    const merged = [...existing, ...newEntries];
    // Sort by date
    merged.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    writeFileSync(MEME_REGISTRY_PATH, JSON.stringify(merged, null, 2) + "\n");
    console.log(`  ✅ wrote ${merged.length} entries to meme_registry.json`);
  }

  await page.close();
  return newEntries.length;
}

// ── Also update top_tweets_registry with official tweets (text/metadata) ─────

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
      likes: 0,
      views: 0,
      reposts: 0,
      replies: 0,
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
  console.log(`  dry-run: ${DRY_RUN}, no-push: ${NO_PUSH}, artists: ${CRAWL_ARTISTS}`);
  console.log(`${"=".repeat(60)}`);

  if (!existsSync(CHROME_DEFAULT)) {
    console.error("Chrome Default profile not found at:", CHROME_DEFAULT);
    process.exit(1);
  }

  const profileDir = makeTempProfile();

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",  // use system Chrome, not bundled Chromium (handles encrypted profile tokens)
    headless: false,    // X requires a visible browser
    viewport: VIEWPORT,
    args: ["--no-sandbox"],
  });

  let totalNew = 0;

  try {
    totalNew += await crawlMidEvils(context);
    totalNew += await crawlOfficialTweets(context);

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
