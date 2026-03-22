/**
 * crawl-artist-profiles.mjs
 *
 * Collects ALL image-containing tweets from the MidEvils artist accounts:
 *   @sircandyapple  — lead artist
 *   @jonnydegods    — daily drawings series
 *
 * Uses the /media tab on each profile (more reliable than the timeline view)
 * to extract tweet URLs, then derives tweet IDs and dates from those URLs.
 *
 * Output: ~/midevils/archive/top_tweets/artist_tweets_registry.json
 *   (deduped against existing entries)
 *
 * After running, copy the output to the web data folder and push:
 *   cp ~/midevils/archive/top_tweets/artist_tweets_registry.json \
 *      ~/common/web/data/midevils/top_tweets/artist_tweets_registry.json
 *
 * Prerequisites (already installed):
 *   npm install playwright
 *   npx playwright install chromium
 */

import { chromium } from "playwright";
import {
  readFileSync, writeFileSync, existsSync, mkdtempSync,
} from "fs";
import { resolve, join } from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";
import os from "os";

// ── Config ────────────────────────────────────────────────────────────────────

const ARCHIVE_DIR = resolve(os.homedir(), "midevils/archive/top_tweets");
const OUT_PATH    = resolve(ARCHIVE_DIR, "artist_tweets_registry.json");
const CHROME_DEFAULT = resolve(
  os.homedir(),
  "Library/Application Support/Google/Chrome/Default"
);

const ARTISTS = [
  { handle: "sircandyapple", username: "sircandyapple" },
  { handle: "jonnydegods",   username: "jonnydegods"   },
];

const VIEWPORT      = { width: 1280, height: 900 };
const LOAD_WAIT     = 5000;  // ms after navigation before extracting
const SCROLL_WAIT   = 2500;  // ms after each scroll
const SCROLL_ROUNDS = 10;    // rounds per profile (media tab loads ~20 items/round → ~200 tweets)

// ── Snowflake ID → date ───────────────────────────────────────────────────────
// X tweet IDs are snowflake IDs — the timestamp is encoded in the upper bits.
function tweetIdToDate(idStr) {
  try {
    const ms = Number(BigInt(idStr) >> 22n) + 1288834974657;
    return new Date(ms).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

// ── Load existing registry ────────────────────────────────────────────────────

const existing = existsSync(OUT_PATH)
  ? JSON.parse(readFileSync(OUT_PATH, "utf8"))
  : [];

const existingIds = new Set(existing.map(e => e.tweet_id).filter(Boolean));
console.log(`📋  ${existing.length} existing artist entries loaded\n`);

// ── Copy Chrome profile ───────────────────────────────────────────────────────

const tempDir = mkdtempSync(join(tmpdir(), "chrome-artist-"));
console.log("📋  Copying Chrome profile…");
execSync(`cp -r "${CHROME_DEFAULT}" "${tempDir}/Default"`, { stdio: "inherit" });
console.log("    Done.\n");

// ── Browser ───────────────────────────────────────────────────────────────────

const context = await chromium.launchPersistentContext(tempDir, {
  channel:  "chrome",
  headless: false,
  viewport: VIEWPORT,
  args:     ["--no-sandbox"],
});

const page = await context.newPage();
const newEntries = [];

// ── Scrape each artist ────────────────────────────────────────────────────────

for (const artist of ARTISTS) {
  console.log(`\n🎨  @${artist.handle} — media tab`);

  try {
    await page.goto(`https://x.com/${artist.handle}/media`, {
      waitUntil: "domcontentloaded",
      timeout:   30000,
    });

    // Wait for the media grid to appear
    await page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(LOAD_WAIT);

    const seenOnProfile = new Set();
    let artistNew = 0;

    for (let round = 0; round < SCROLL_ROUNDS; round++) {
      // Extract all tweet status links visible on the page
      const links = await page.evaluate(() => {
        const anchors = document.querySelectorAll('a[href*="/status/"]');
        const urls = new Set();
        for (const a of anchors) {
          const href = a.getAttribute("href") ?? "";
          // Only capture /username/status/id links (not photo sub-pages)
          const m = href.match(/^\/([^/]+)\/status\/(\d+)$/);
          if (m) urls.add(href);
        }
        return [...urls];
      });

      for (const href of links) {
        const m = href.match(/\/status\/(\d+)/);
        if (!m) continue;
        const tweetId = m[1];
        if (seenOnProfile.has(tweetId) || existingIds.has(tweetId)) continue;
        seenOnProfile.add(tweetId);

        const date = tweetIdToDate(tweetId);
        const url  = `https://x.com${href}`;

        newEntries.push({
          url,
          tweet_id: tweetId,
          username: artist.username,
          date,
          text:     "",
          likes:    0,
          views:    0,
          reposts:  0,
        });

        existingIds.add(tweetId);
        artistNew++;
      }

      if (round < SCROLL_ROUNDS - 1) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
        await page.waitForTimeout(SCROLL_WAIT);
      }
    }

    console.log(`    ✅  ${artistNew} new tweets found`);

  } catch (err) {
    console.error(`    ❌  Failed: ${err.message.split("\n")[0]}`);
  }
}

await context.close();

// ── Save ──────────────────────────────────────────────────────────────────────

const updated = [...existing, ...newEntries];
// Sort by date descending (newest first)
updated.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

writeFileSync(OUT_PATH, JSON.stringify(updated, null, 2));

console.log(`\n${"─".repeat(60)}`);
console.log(`✅  Done`);
console.log(`   ${newEntries.length} new entries added`);
console.log(`   ${updated.length} total in artist_tweets_registry.json`);
console.log(`\nCopy to web data folder:`);
console.log(`   cp "${OUT_PATH}" ~/common/web/data/midevils/top_tweets/artist_tweets_registry.json`);
console.log(`\nThen push to production:`);
console.log(`   cd ~/common/web && git stash && git pull --rebase origin main && git add data/midevils/top_tweets/artist_tweets_registry.json && git commit -m "Add artist tweets registry" && git push origin main && git stash pop`);
