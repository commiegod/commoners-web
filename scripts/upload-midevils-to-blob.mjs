/**
 * upload-midevils-to-blob.mjs
 *
 * Uploads the MidEvils image archive to Vercel Blob, preserving the
 * directory structure used by the timeline API.
 *
 * Usage:
 *   node scripts/upload-midevils-to-blob.mjs
 *
 * Required env vars (pick them up from .env.local automatically, or export them):
 *   BLOB_READ_WRITE_TOKEN   — your Vercel Blob token
 *   MIDEVILS_ARCHIVE_PATH   — absolute path to the archive folder
 *
 * Optional:
 *   DRY_RUN=1               — print what would be uploaded, don't upload
 *   CONCURRENCY=10          — parallel uploads (default 10)
 *
 * After a successful run this script prints the store base URL.
 * Set that as NEXT_PUBLIC_MIDEVILS_IMAGE_BASE_URL in Vercel's env settings.
 */

import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { put, list } from "@vercel/blob";

// ── Load .env.local if running outside Next.js ────────────────────────────────
try {
  const envPath = new URL("../.env.local", import.meta.url).pathname;
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch { /* ignore */ }

// ── Config ────────────────────────────────────────────────────────────────────
const ARCHIVE   = process.env.MIDEVILS_ARCHIVE_PATH;
const TOKEN     = process.env.BLOB_READ_WRITE_TOKEN;
const DRY_RUN   = process.env.DRY_RUN === "1";
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "10", 10);
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const MIME_TYPES = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".gif":  "image/gif",
  ".webp": "image/webp",
};

if (!ARCHIVE) {
  console.error("❌  MIDEVILS_ARCHIVE_PATH is not set.");
  process.exit(1);
}
if (!TOKEN && !DRY_RUN) {
  console.error("❌  BLOB_READ_WRITE_TOKEN is not set.");
  process.exit(1);
}

// ── Sanitize for Blob keys (colons not valid in object keys) ──────────────────
function blobKey(archivePath) {
  return archivePath.replace(/:/g, "_");
}

// ── Collect all images to upload ──────────────────────────────────────────────
function collectFiles() {
  const files = []; // { localPath, blobPath }

  const discordReg = join(ARCHIVE, "discord_registry.json");
  const memeReg    = join(ARCHIVE, "meme_registry.json");
  const tweetReg   = join(ARCHIVE, "top_tweets", "top_tweets_registry.json");

  // Discord images
  if (existsSync(discordReg)) {
    const discord = JSON.parse(readFileSync(discordReg, "utf8"));
    for (const m of discord) {
      if (!m.downloaded || !m.filename_local || !m.month || !m.channel) continue;
      const relPath   = `by-month/discord/${m.month}/${m.channel}/${m.filename_local}`;
      const localPath = join(ARCHIVE, relPath);
      const ext = extname(m.filename_local).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;
      if (!existsSync(localPath)) continue;
      files.push({ localPath, blobPath: blobKey(relPath) });
    }
  }

  // Community tweet images (meme_registry)
  if (existsSync(memeReg)) {
    const memes = JSON.parse(readFileSync(memeReg, "utf8"));
    for (const m of memes) {
      if (!m.downloaded || !m.filename || !m.month) continue;
      const relPath   = `by-month/${m.month}/${m.filename}`;
      const localPath = join(ARCHIVE, relPath);
      const ext = extname(m.filename).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;
      if (!existsSync(localPath)) continue;
      files.push({ localPath, blobPath: blobKey(relPath) });
    }
  }

  // Top tweet screenshots
  if (existsSync(tweetReg)) {
    const tweets = JSON.parse(readFileSync(tweetReg, "utf8"));
    for (const t of tweets) {
      if (!t.screenshot) continue;
      const relPath   = `top_tweets/${t.screenshot}`;
      const localPath = join(ARCHIVE, relPath);
      const ext = extname(t.screenshot).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;
      if (!existsSync(localPath)) continue;
      files.push({ localPath, blobPath: blobKey(relPath) });
    }
  }

  return files;
}

// ── Get already-uploaded blob keys ────────────────────────────────────────────
async function getExistingKeys() {
  const existing = new Set();
  let cursor;
  do {
    const result = await list({ token: TOKEN, cursor, limit: 1000 });
    for (const blob of result.blobs) {
      // blob.pathname is the key used when uploading
      existing.add(blob.pathname);
    }
    cursor = result.cursor;
  } while (cursor);
  return existing;
}

// ── Upload a single file (with timeout + retry) ───────────────────────────────
const UPLOAD_TIMEOUT_MS = 60_000; // 60 s per file before giving up
const MAX_RETRIES = 3;
const DELAY_MS = 150;             // pause between uploads to avoid rate limits

// Discord CDN uses this hash for expired/deleted placeholder images — skip them
const SKIP_HASHES = new Set(["be6cfc6c"]);

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

async function uploadFile({ localPath, blobPath }) {
  const ext  = extname(localPath).toLowerCase();
  const mime = MIME_TYPES[ext] || "image/jpeg";
  const data = readFileSync(localPath);

  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await withTimeout(
        put(blobPath, data, {
          access:          "public",
          contentType:     mime,
          token:           TOKEN,
          addRandomSuffix: false,
        }),
        UPLOAD_TIMEOUT_MS,
        blobPath
      );
      return result.url;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
async function runPool(tasks, concurrency, worker) {
  let idx = 0;
  let done = 0;
  const total = tasks.length;
  const errors = [];

  async function runNext() {
    while (idx < tasks.length) {
      const i = idx++;
      const task = tasks[i];
      // Skip Discord placeholder images
      const basename = task.localPath.split("/").pop().replace(/\.[^.]+$/, "");
      const hash = basename.split("_").pop();
      if (SKIP_HASHES.has(hash)) {
        done++;
        continue;
      }

      process.stdout.write(`\r  [${done + 1}/${total}] ${task.blobPath.slice(-60).padEnd(60)}`);
      try {
        await worker(task);
      } catch (err) {
        errors.push({ task, err });
        process.stdout.write(`\n  ⚠ FAILED: ${task.blobPath}\n     ${err.message}\n`);
      }
      done++;
      if (DELAY_MS > 0) await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  const workers = Array.from({ length: concurrency }, runNext);
  await Promise.all(workers);
  process.stdout.write("\n");
  return errors;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📦  MidEvils → Vercel Blob uploader`);
  console.log(`    Archive: ${ARCHIVE}`);
  console.log(`    Concurrency: ${CONCURRENCY}`);
  if (DRY_RUN) console.log(`    DRY RUN — nothing will be uploaded\n`);

  console.log("🔍  Collecting image files from registries…");
  const files = collectFiles();
  const totalMB = files.reduce((s, f) => s + statSync(f.localPath).size, 0) / 1024 / 1024;
  console.log(`    Found ${files.length} files (${totalMB.toFixed(0)} MB)\n`);

  if (DRY_RUN) {
    for (const f of files.slice(0, 10)) console.log(`  → ${f.blobPath}`);
    if (files.length > 10) console.log(`  … and ${files.length - 10} more`);
    return;
  }

  // Check what's already uploaded
  console.log("🔎  Checking existing Blob contents…");
  const existing = await getExistingKeys();
  console.log(`    Already uploaded: ${existing.size}`);

  const toUpload = files.filter(f => !existing.has(f.blobPath));
  if (toUpload.length === 0) {
    console.log("\n✅  All files already uploaded! Nothing to do.");
  } else {
    console.log(`    Uploading: ${toUpload.length} new files\n`);
    const errors = await runPool(toUpload, CONCURRENCY, uploadFile);

    if (errors.length > 0) {
      console.error(`\n⚠️   ${errors.length} uploads failed:`);
      for (const { task, err } of errors.slice(0, 5)) {
        console.error(`    ${task.blobPath}: ${err.message}`);
      }
    }
  }

  // Print the base URL from any blob
  if (files.length > 0) {
    const sample = await list({ token: TOKEN, limit: 1 });
    if (sample.blobs.length > 0) {
      // Base URL is everything before the pathname
      const sampleUrl = new URL(sample.blobs[0].url);
      const baseUrl = `${sampleUrl.origin}`;
      console.log(`\n✅  Done!`);
      console.log(`\n   Set this in Vercel's environment variables:`);
      console.log(`   NEXT_PUBLIC_MIDEVILS_IMAGE_BASE_URL=${baseUrl}\n`);
    }
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
