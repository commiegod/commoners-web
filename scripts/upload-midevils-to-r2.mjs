/**
 * upload-midevils-to-r2.mjs
 *
 * Uploads Discord attachment images to Cloudflare R2 (S3-compatible).
 * Twitter/embed images are served directly from pbs.twimg.com — not uploaded.
 *
 * Setup:
 *   npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
 *
 * Required env vars (loaded from .env.local automatically):
 *   R2_ACCESS_KEY_ID       — R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY   — R2 API token Secret Access Key
 *   R2_ACCOUNT_ID          — Cloudflare Account ID (from R2 overview page)
 *   R2_BUCKET              — Bucket name (commoners-dao)
 *   MIDEVILS_ARCHIVE_PATH  — Absolute path to the archive folder
 *
 * Optional:
 *   DRY_RUN=1              — Print what would be uploaded, don't upload
 *   CONCURRENCY=10         — Parallel uploads (default 10)
 *
 * After a successful run, set NEXT_PUBLIC_MIDEVILS_IMAGE_BASE_URL in Vercel
 * to your R2 public bucket URL (e.g. https://pub-xxxx.r2.dev).
 */

import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { S3Client, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// ── Load .env.local ───────────────────────────────────────────────────────────
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
const ARCHIVE     = process.env.MIDEVILS_ARCHIVE_PATH;
const ACCOUNT_ID  = process.env.R2_ACCOUNT_ID;
const BUCKET      = process.env.R2_BUCKET ?? "commoners-dao";
const DRY_RUN     = process.env.DRY_RUN === "1";
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "10", 10);
const DELAY_MS    = 50; // small delay between uploads

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const MIME_TYPES = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png",  ".gif": "image/gif",
  ".webp": "image/webp", ".avif": "image/avif",
};

if (!ARCHIVE)    { console.error("❌  MIDEVILS_ARCHIVE_PATH is not set"); process.exit(1); }
if (!ACCOUNT_ID) { console.error("❌  R2_ACCOUNT_ID is not set"); process.exit(1); }
if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  if (!DRY_RUN) { console.error("❌  R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY not set"); process.exit(1); }
}

// ── R2 S3 client ─────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

// ── Collect files ─────────────────────────────────────────────────────────────
function collectFiles() {
  const files = [];
  const discordReg = join(ARCHIVE, "discord_registry.json");
  const tweetReg   = join(ARCHIVE, "top_tweets", "top_tweets_registry.json");

  // Discord ATTACHMENT images only (embed type = direct Twitter URL, skip)
  if (existsSync(discordReg)) {
    const discord = JSON.parse(readFileSync(discordReg, "utf8"));
    for (const m of discord) {
      if (!m.downloaded || !m.filename_local || !m.month || !m.channel) continue;
      if (m.type !== "attachment") continue;
      if (m.filename_local.includes("be6cfc6c")) continue;
      const relPath   = `by-month/discord/${m.month}/${m.channel}/${m.filename_local}`;
      const localPath = join(ARCHIVE, relPath);
      const ext = extname(m.filename_local).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;
      if (!existsSync(localPath)) continue;
      files.push({ localPath, key: relPath });
    }
  }

  // Top tweet screenshots (manually captured, if any)
  if (existsSync(tweetReg)) {
    const tweets = JSON.parse(readFileSync(tweetReg, "utf8"));
    for (const t of tweets) {
      if (!t.screenshot) continue;
      const relPath   = `top_tweets/${t.screenshot}`;
      const localPath = join(ARCHIVE, relPath);
      const ext = extname(t.screenshot).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;
      if (!existsSync(localPath)) continue;
      files.push({ localPath, key: relPath });
    }
  }

  // meme_registry — all served directly from pbs.twimg.com, not uploaded
  return files;
}

// ── Get already-uploaded keys (paginated list) ────────────────────────────────
async function getExistingKeys() {
  const existing = new Set();
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    for (const obj of res.Contents ?? []) existing.add(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return existing;
}

// ── Upload a single file ──────────────────────────────────────────────────────
async function uploadFile({ localPath, key }) {
  const ext  = extname(localPath).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";

  const upload = new Upload({
    client: s3,
    params: {
      Bucket:      BUCKET,
      Key:         key,
      Body:        readFileSync(localPath),
      ContentType: mime,
    },
  });
  await upload.done();
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
async function runPool(tasks, concurrency, worker) {
  let idx = 0, done = 0;
  const errors = [];
  const total = tasks.length;

  async function runNext() {
    while (idx < tasks.length) {
      const i    = idx++;
      const task = tasks[i];
      process.stdout.write(`\r  [${done + 1}/${total}] ${task.key.slice(-60).padEnd(60)}`);
      try {
        await worker(task);
      } catch (err) {
        errors.push({ task, err });
        process.stdout.write(`\n  ⚠ FAILED: ${task.key}\n     ${err.message}\n`);
      }
      done++;
      if (DELAY_MS > 0) await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, runNext));
  process.stdout.write("\n");
  return errors;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📦  MidEvils → Cloudflare R2 uploader`);
  console.log(`    Bucket:      ${BUCKET}`);
  console.log(`    Archive:     ${ARCHIVE}`);
  console.log(`    Concurrency: ${CONCURRENCY}`);
  if (DRY_RUN) console.log(`    DRY RUN — nothing will be uploaded\n`);

  console.log("🔍  Collecting files…");
  const files   = collectFiles();
  const totalMB = files.reduce((s, f) => s + statSync(f.localPath).size, 0) / 1024 / 1024;
  console.log(`    Found ${files.length} files (${totalMB.toFixed(0)} MB)\n`);

  if (DRY_RUN) {
    for (const f of files.slice(0, 10)) console.log(`  → ${f.key}`);
    if (files.length > 10) console.log(`  … and ${files.length - 10} more`);
    return;
  }

  console.log("🔎  Checking existing R2 objects…");
  const existing = await getExistingKeys();
  console.log(`    Already uploaded: ${existing.size}`);

  const toUpload = files.filter(f => !existing.has(f.key));
  if (toUpload.length === 0) {
    console.log("\n✅  All files already uploaded!");
  } else {
    console.log(`    Uploading: ${toUpload.length} new files\n`);
    const errors = await runPool(toUpload, CONCURRENCY, uploadFile);
    if (errors.length > 0) {
      console.error(`\n⚠️   ${errors.length} failed:`);
      for (const { task, err } of errors.slice(0, 5))
        console.error(`    ${task.key}: ${err.message}`);
    }
  }

  console.log(`\n✅  Done!`);
  console.log(`\n   Set in Vercel environment variables:`);
  console.log(`   NEXT_PUBLIC_MIDEVILS_IMAGE_BASE_URL=https://pub-XXXX.r2.dev`);
  console.log(`   (replace with your actual R2 public bucket URL)\n`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
