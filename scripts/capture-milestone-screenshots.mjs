/**
 * capture-milestone-screenshots.mjs
 *
 * Screenshots each milestone tweet using your existing Chrome login and saves
 * them to: ~/midevils/archive/top_tweets/<filename>.png
 *
 * Copies your Chrome Default profile to a temp dir so it can run alongside
 * an already-open Chrome without conflicting. Make sure you're logged into X
 * in Chrome before running.
 *
 * After running, upload the new files to R2:
 *   node scripts/upload-midevils-to-r2.mjs
 *
 * Prerequisites:
 *   npm install playwright
 *   npx playwright install chromium
 */

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import os from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────────────────────────

const ARCHIVE_DIR   = resolve(os.homedir(), "midevils/archive/top_tweets");
const REGISTRY_PATH = resolve(ARCHIVE_DIR, "top_tweets_registry.json");
const CHROME_DEFAULT = resolve(
  os.homedir(),
  "Library/Application Support/Google/Chrome/Default"
);
const VIEWPORT    = { width: 680, height: 900 };
const RENDER_WAIT = 3500; // ms to wait after page load

// ── Main ──────────────────────────────────────────────────────────────────────

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
const tweets   = Array.isArray(registry) ? registry : registry.tweets ?? [];
mkdirSync(ARCHIVE_DIR, { recursive: true });

// Copy your Chrome Default profile to a temp dir so it can run alongside
// the already-open Chrome (avoids SingletonLock conflict)
const tempDir = mkdtempSync(join(tmpdir(), "chrome-capture-"));
console.log("📋  Copying Chrome profile (cookies/session)…");
execSync(`cp -r "${CHROME_DEFAULT}" "${tempDir}/Default"`, { stdio: "inherit" });
console.log("    Done.\n");

const context = await chromium.launchPersistentContext(tempDir, {
  channel: "chrome",
  headless: false,
  viewport: VIEWPORT,
  args: ["--no-sandbox"],
});

const page = await context.newPage();

let saved = 0;
let failed = 0;

for (const tweet of tweets) {
  if (!tweet.screenshot || !tweet.url) {
    console.log(`⚠   Skipping entry with no screenshot/url`);
    continue;
  }

  const outPath = resolve(ARCHIVE_DIR, tweet.screenshot);
  console.log(`\n📸  ${tweet.screenshot}`);
  console.log(`    ${tweet.url}`);

  try {
    // X never reaches "networkidle" — use domcontentloaded + fixed wait instead
    await page.goto(tweet.url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for the tweet article to actually appear in the DOM
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 })
      .catch(() => {}); // don't throw if it doesn't appear — fallback handles it

    await page.waitForTimeout(RENDER_WAIT);

    // Hide the sticky header so it doesn't overlap the tweet
    await page.evaluate(() => {
      document.querySelectorAll('header[role="banner"]').forEach(el => el.style.display = "none");
    });

    // Find the primary tweet article and screenshot just that element
    const article = page.locator('article[data-testid="tweet"]').first();
    const count   = await article.count();

    if (count > 0) {
      await article.screenshot({ path: outPath });
      console.log(`    ✅  Saved (tweet card)`);
      saved++;
    } else {
      // Fall back to a viewport-width crop at the top of the page
      await page.screenshot({ path: outPath, clip: { x: 0, y: 60, width: 680, height: 640 } });
      console.log(`    ✅  Saved (fallback crop)`);
      saved++;
    }
  } catch (err) {
    console.error(`    ❌  Failed: ${err.message}`);
    failed++;
  }
}

await context.close();

console.log(`\n✅  Done — ${saved} saved, ${failed} failed`);
console.log(`   Files: ${ARCHIVE_DIR}`);
console.log(`\nNext — upload to R2:`);
console.log(`   node scripts/upload-midevils-to-r2.mjs`);
