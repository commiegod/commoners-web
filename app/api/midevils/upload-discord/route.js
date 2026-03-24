import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// ── Config ────────────────────────────────────────────────────────────────────
const ADMIN_SECRET  = process.env.ADMIN_SECRET;
const ACCOUNT_ID    = process.env.R2_ACCOUNT_ID;
const BUCKET        = process.env.R2_BUCKET ?? "commoners-dao";
const PUBLIC_BASE   = (process.env.NEXT_PUBLIC_MIDEVILS_IMAGE_BASE_URL ?? "").replace(/\/$/, "");

const ALLOWED_EXTS  = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const MIME_TYPES    = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png",  ".gif":  "image/gif",
  ".webp": "image/webp", ".avif": "image/avif",
};

// Max items per request and per-image size cap (20 MB)
const MAX_ITEMS     = 50;
const MAX_BYTES     = 20 * 1024 * 1024;

// ── R2 client (initialised lazily so missing creds don't crash cold starts) ──
let _s3 = null;
function getS3() {
  if (_s3) return _s3;
  if (!ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials not configured");
  }
  _s3 = new S3Client({
    region:   "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _s3;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function extOf(key) {
  const dot = key.lastIndexOf(".");
  return dot >= 0 ? key.slice(dot).toLowerCase() : "";
}

function sanitiseKey(key) {
  // Block path traversal; only allow safe characters
  if (!key || /\.\./.test(key) || key.startsWith("/")) return null;
  if (!/^[\w\-./]+$/.test(key)) return null;
  return key;
}

async function alreadyExists(s3, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadOne(s3, { url, key }) {
  const safeKey = sanitiseKey(key);
  if (!safeKey) return { key, ok: false, error: "invalid key" };

  const ext = extOf(safeKey);
  if (!ALLOWED_EXTS.has(ext)) return { key, ok: false, error: "disallowed extension" };

  // Skip if already in R2
  if (await alreadyExists(s3, safeKey)) {
    return { key: safeKey, ok: true, skipped: true, r2Url: `${PUBLIC_BASE}/${safeKey}` };
  }

  // Fetch the source image (Vercel has full outbound internet)
  let body;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: { "User-Agent": "commonersdao-archiver/1.0" },
    });
    if (!res.ok) return { key: safeKey, ok: false, error: `fetch ${res.status}` };

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return { key: safeKey, ok: false, error: `image too large (${buf.byteLength} bytes)` };
    }
    body = Buffer.from(buf);
  } catch (err) {
    return { key: safeKey, ok: false, error: `fetch failed: ${err.message}` };
  }

  // Upload to R2
  try {
    await s3.send(new PutObjectCommand({
      Bucket:       BUCKET,
      Key:          safeKey,
      Body:         body,
      ContentType:  MIME_TYPES[ext] ?? "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }));
  } catch (err) {
    return { key: safeKey, ok: false, error: `r2 upload failed: ${err.message}` };
  }

  return { key: safeKey, ok: true, r2Url: `${PUBLIC_BASE}/${safeKey}` };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!ADMIN_SECRET) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let items;
  try {
    const body = await request.json();
    items = body?.items;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Too many items (max ${MAX_ITEMS})` }, { status: 400 });
  }
  for (const item of items) {
    if (!item?.url || !item?.key || typeof item.url !== "string" || typeof item.key !== "string") {
      return NextResponse.json({ error: "Each item needs { url, key }" }, { status: 400 });
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  let s3;
  try {
    s3 = getS3();
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  // Process in parallel batches of 10
  const CONCURRENCY = 10;
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(item => uploadOne(s3, item)));
    results.push(...batchResults);
  }

  const uploaded = results.filter(r => r.ok && !r.skipped).length;
  const skipped  = results.filter(r => r.ok && r.skipped).length;
  const failed   = results.filter(r => !r.ok).length;

  return NextResponse.json({ uploaded, skipped, failed, results }, {
    headers: { "Cache-Control": "no-store" },
  });
}
