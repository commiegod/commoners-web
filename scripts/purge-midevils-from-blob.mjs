/**
 * purge-midevils-from-blob.mjs
 *
 * Deletes all blobs under the by-month/ prefix from Vercel Blob.
 * Run this before re-uploading with upload-midevils-to-blob.mjs
 * to clear out old partial/incorrect uploads.
 *
 * Usage:
 *   node scripts/purge-midevils-from-blob.mjs
 *   DRY_RUN=1 node scripts/purge-midevils-from-blob.mjs
 */

import { readFileSync, existsSync } from "fs";
import { list, del } from "@vercel/blob";

// Load .env.local
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

const TOKEN   = process.env.BLOB_READ_WRITE_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!TOKEN) { console.error("❌  BLOB_READ_WRITE_TOKEN not set"); process.exit(1); }

async function main() {
  console.log(`\n🗑️  Purging by-month/ blobs from Vercel Blob store`);
  if (DRY_RUN) console.log("   DRY RUN — nothing will be deleted\n");

  let cursor;
  let total = 0;
  let deleted = 0;

  do {
    const result = await list({ token: TOKEN, cursor, limit: 1000, prefix: "by-month/" });
    total += result.blobs.length;

    const urls = result.blobs.map(b => b.url);
    // Delete in small batches of 25 to avoid rate limits
    const BATCH = 25;
    for (let i = 0; i < urls.length; i += BATCH) {
      const chunk = urls.slice(i, i + BATCH);
      process.stdout.write(`\r  Deleted ${deleted + chunk.length} blobs...`);
      if (!DRY_RUN) {
        await del(chunk, { token: TOKEN });
        await new Promise(r => setTimeout(r, 300)); // 300ms between batches
      }
      deleted += chunk.length;
    }

    cursor = result.cursor;
  } while (cursor);

  process.stdout.write("\n");
  console.log(`\n✅  Done — ${DRY_RUN ? "would have deleted" : "deleted"} ${deleted} blobs\n`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
