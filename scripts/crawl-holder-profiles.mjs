/**
 * crawl-holder-profiles.mjs
 *
 * Scrapes recent image-containing tweets from a curated list of holder/community accounts.
 * Uses your existing logged-in Chrome profile (same approach as capture-milestone-screenshots.mjs).
 *
 * Output: ~/midevils/archive/holder_tweets_registry.json
 *   - Deduplicated against meme_registry.json so there's no overlap
 *   - Same schema as meme_registry so the dashboard reads both
 *
 * Usage:
 *   cd ~/common/web
 *   node scripts/crawl-holder-profiles.mjs
 *
 * After crawling, rebuild the dashboard:
 *   node scripts/rebuild-dashboard.mjs
 *
 * Prerequisites (already installed if you've run other scripts):
 *   npm install playwright
 *   npx playwright install chromium
 */

import { chromium } from "playwright";
import {
  readFileSync, writeFileSync, existsSync, mkdtempSync,
} from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { tmpdir } from "os";
import os from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const ARCHIVE_DIR     = resolve(os.homedir(), "midevils/archive");
const MEME_REG_PATH   = resolve(ARCHIVE_DIR, "meme_registry.json");
const OUT_PATH        = resolve(ARCHIVE_DIR, "holder_tweets_registry.json");
const CHROME_DEFAULT  = resolve(
  os.homedir(),
  "Library/Application Support/Google/Chrome/Default"
);

const VIEWPORT       = { width: 1280, height: 900 };
const RENDER_WAIT    = 4000;  // ms to wait after navigating to a profile
const SCROLL_WAIT    = 2500;  // ms to wait after each scroll
const SCROLL_ROUNDS  = 6;     // scroll rounds per profile (~50-80 tweets)
const PROFILE_DELAY  = 2500;  // ms between handles (be gentle)
const MIN_SCORE      = 3;     // skip very low engagement posts

// How many months back to include tweets
const MONTHS_LOOKBACK = 12;

// Curated list of top holder / community accounts
const HANDLES = [
  "midevilsnft", "sircandyapple", "jonnydegods", "risencovenant",
  "thenftcat_sol", "midhorde", "midfoolsgold", "mickevils",
  "theghostars", "midcrowncom", "reeversnft", "santiago_N_hawk",
  "magiceden", "truemerlin", "cavecreativenft", "mid_iron_order",
  "synndrabtc", "ayab7501", "brokefury", "brodysbettas",
  "zeefi_x", "527hats", "ayberksol_", "hutch3_io",
  "commiegod", "haxz_xyz", "solbermike", "swasti_art",
  "xMJ_GAMINGx", "utilimaster0", "YeazusNFTs", "Primatesnft",
  "Sold_The_Dip", "YAKS293", "ToshSolana", "theHAWKx",
  "xIAMVx", "HaizeelH", "Berniemanski", "0xlamaglama",
  "hikarudegods", "ethan_solsquad", "GateNFT", "freshlyretro",
  "Topo_G", "CHICKENNY_",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function engagementScore({ likes = 0, reposts = 0, replies = 0, views = 0 }) {
  return likes + (reposts * 3) + (replies * 2) + (views / 200);
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

// ── DOM extraction — runs inside the browser page ────────────────────────────
// Passed as a string so we can use `handle` from the outer scope via arg.

async function extractTweetsFromPage(page, handle) {
  return page.evaluate((currentHandle) => {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    const results  = [];

    for (const article of articles) {
      // Tweet URL via timestamp link
      const timeEl   = article.querySelector("time");
      const timeLink = timeEl?.closest("a");
      if (!timeLink) continue;

      const href          = timeLink.getAttribute("href") ?? "";
      const tweetIdMatch  = href.match(/\/status\/(\d+)/);
      if (!tweetIdMatch) continue;

      const tweetId  = tweetIdMatch[1];
      const tweetUrl = "https://x.com" + href;

      // Author from URL — skip if it's a retweet (different author)
      const authorMatch = href.match(/^\/([^/]+)\/status/);
      const author      = authorMatch ? authorMatch[1].toLowerCase() : "";
      if (author !== currentHandle.toLowerCase()) continue;

      // Date
      const date = timeEl.getAttribute("datetime")?.split("T")[0] ?? null;

      // Tweet text (skip retweet marker — belt + suspenders)
      const textEl = article.querySelector('[data-testid="tweetText"]');
      const text   = textEl?.textContent.trim() ?? "";
      if (text.startsWith("RT @")) continue;

      // Must contain at least one pbs.twimg.com/media image
      const imgEls = Array.from(article.querySelectorAll("img"))
        .filter(img => img.src.includes("pbs.twimg.com/media"));
      if (imgEls.length === 0) continue;

      // Build media items
      const mediaItems = imgEls.map(img => {
        const mediaMatch = img.src.match(/media\/([A-Za-z0-9_-]+)/);
        const mediaId    = mediaMatch?.[1] ?? null;
        const imgUrl     = mediaId
          ? `https://pbs.twimg.com/media/${mediaId}?format=jpg&name=large`
          : null;
        return { mediaId, imgUrl };
      }).filter(m => m.mediaId && m.imgUrl);

      if (mediaItems.length === 0) continue;

      // Engagement counts — parse from aria-labels on action buttons
      const parseAria = (el) => {
        if (!el) return 0;
        const label = el.getAttribute("aria-label") ?? "";
        const m     = label.match(/([\d,]+)/);
        return m ? parseInt(m[1].replace(/,/g, "")) : 0;
      };

      const likes   = parseAria(article.querySelector('[data-testid="like"]'));
      const reposts = parseAria(article.querySelector('[data-testid="retweet"]'));
      const replies = parseAria(article.querySelector('[data-testid="reply"]'));
      const viewsEl = article.querySelector('a[href*="/analytics"]');
      const views   = parseAria(viewsEl);

      results.push({
        tweetId, tweetUrl, username: authorMatch?.[1] ?? currentHandle,
        text, date, mediaItems,
        likes, reposts, replies, views,
      });
    }

    return results;
  }, handle);
}

// ── Load existing registries to dedup ────────────────────────────────────────

const existingIds = new Set();

if (existsSync(MEME_REG_PATH)) {
  const reg = JSON.parse(readFileSync(MEME_REG_PATH, "utf8"));
  for (const e of reg) if (e.tweet_id) existingIds.add(e.tweet_id);
  console.log(`📋  ${reg.length} entries loaded from meme_registry`);
}

const holderRegistry = existsSync(OUT_PATH)
  ? JSON.parse(readFileSync(OUT_PATH, "utf8"))
  : [];
for (const e of holderRegistry) if (e.tweet_id) existingIds.add(e.tweet_id);
console.log(`📋  ${holderRegistry.length} existing holder registry entries`);
console.log(`📋  ${existingIds.size} total known tweet IDs\n`);

// ── Copy Chrome profile ───────────────────────────────────────────────────────

const tempDir = mkdtempSync(join(tmpdir(), "chrome-crawl-"));
console.log("📋  Copying Chrome profile (cookies/session)…");
execSync(`cp -r "${CHROME_DEFAULT}" "${tempDir}/Default"`, { stdio: "inherit" });
console.log("    Done.\n");

// ── Browser session ───────────────────────────────────────────────────────────

const context = await chromium.launchPersistentContext(tempDir, {
  channel:  "chrome",
  headless: false,
  viewport: VIEWPORT,
  args:     ["--no-sandbox"],
});

const page   = await context.newPage();
const cutoff = monthsAgo(MONTHS_LOOKBACK);

const newEntries   = [];
const seenThisRun  = new Set(existingIds); // don't re-add within this run

let totalProfiles = 0;
let totalNew      = 0;

// ── Main loop ─────────────────────────────────────────────────────────────────

for (const handle of HANDLES) {
  console.log(`\n👤  @${handle}`);

  try {
    await page.goto(`https://x.com/${handle}`, {
      waitUntil: "domcontentloaded",
      timeout:   30000,
    });

    // Wait for first tweet to appear
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(RENDER_WAIT);

    let profileNew = 0;
    let hitCutoff  = false;

    for (let round = 0; round < SCROLL_ROUNDS && !hitCutoff; round++) {
      const tweets = await extractTweetsFromPage(page, handle);

      for (const t of tweets) {
        if (seenThisRun.has(t.tweetId)) continue;
        seenThisRun.add(t.tweetId);

        // Date cutoff
        if (t.date && new Date(t.date) < cutoff) {
          hitCutoff = true;
          continue;
        }

        const score = engagementScore(t);
        if (score < MIN_SCORE) continue;

        // One entry per media item (matches meme_registry schema)
        for (const media of t.mediaItems) {
          const month    = t.date ? t.date.slice(0, 7) : "unknown";
          const filename = `${t.date}_${t.username}_${media.mediaId}.jpg`;

          newEntries.push({
            filename,
            month,
            date:       t.date,
            username:   t.username,
            tweet_id:   t.tweetId,
            tweet_url:  t.tweetUrl,
            media_id:   media.mediaId,
            img_url:    media.imgUrl,
            downloaded: false,
            likes:      t.likes,
            reposts:    t.reposts,
            replies:    t.replies,
            views:      t.views,
            score:      Math.round(engagementScore(t) * 10) / 10,
            text:       t.text.slice(0, 280),
            source:     "holder_crawl",
          });

          // Mark so we don't add the same tweet twice (multiple images = multiple media items)
          // but we DO want all media items per tweet — just prevent the tweet from re-entering
          // via a later scroll round
        }

        existingIds.add(t.tweetId); // prevent the same tweet from being added twice
        profileNew++;
      }

      if (round < SCROLL_ROUNDS - 1) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
        await page.waitForTimeout(SCROLL_WAIT);
      }
    }

    totalNew += profileNew;
    totalProfiles++;
    console.log(`    ✅  ${profileNew} new image tweets found`);

  } catch (err) {
    console.error(`    ❌  Failed: ${err.message.split("\n")[0]}`);
  }

  if (HANDLES.indexOf(handle) < HANDLES.length - 1) {
    await page.waitForTimeout(PROFILE_DELAY);
  }
}

await context.close();

// ── Merge and save ────────────────────────────────────────────────────────────

const updated = [...holderRegistry, ...newEntries];
// Sort by score descending
updated.sort((a, b) => b.score - a.score);

writeFileSync(OUT_PATH, JSON.stringify(updated, null, 2));

console.log(`\n${"─".repeat(60)}`);
console.log(`✅  Crawl complete`);
console.log(`   ${totalProfiles} profiles visited`);
console.log(`   ${totalNew} new tweets found`);
console.log(`   ${newEntries.length} new entries added (including multi-image tweets)`);
console.log(`   ${updated.length} total in holder_tweets_registry.json`);
console.log(`\nNext — rebuild the dashboard:`);
console.log(`   node scripts/rebuild-dashboard.mjs`);
