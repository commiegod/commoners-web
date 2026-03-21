import { NextResponse } from "next/server";
import { readFileSync, existsSync, statSync } from "fs";
import { join, resolve, extname } from "path";

// ── Security constants ────────────────────────────────────────────────────────
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const MIME_TYPES = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".gif":  "image/gif",
  ".webp": "image/webp",
};

// Must be set in environment. In production, images should be served
// from Vercel Blob (set MIDEVILS_IMAGE_BASE_URL instead) rather than
// this local file path.
const ARCHIVE_PATH = process.env.MIDEVILS_ARCHIVE_PATH
  ? resolve(process.env.MIDEVILS_ARCHIVE_PATH)
  : null;

export async function GET(request, { params }) {
  // If MIDEVILS_ARCHIVE_PATH is not configured, return 503.
  // In production, images should be served from external storage (Vercel Blob / R2).
  if (!ARCHIVE_PATH) {
    return new NextResponse("Image archive not configured on this server", {
      status: 503,
    });
  }

  const { slug } = await params;

  // ── Input validation ──────────────────────────────────────────────────────
  // Reject any segment that looks like a path traversal attempt
  if (!Array.isArray(slug) || slug.length === 0) {
    return new NextResponse("Bad request", { status: 400 });
  }

  for (const segment of slug) {
    // Disallow empty segments, dots-only names, and percent-encoded traversal
    if (
      !segment ||
      segment === "." ||
      segment === ".." ||
      segment.includes("\0") ||
      /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(segment)
    ) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // ── Path construction and traversal check ─────────────────────────────────
  const relativePath = slug.join("/");
  const fullPath = resolve(join(ARCHIVE_PATH, relativePath));
  const safeBase = ARCHIVE_PATH.endsWith("/") ? ARCHIVE_PATH : ARCHIVE_PATH + "/";

  // The resolved path must be strictly inside ARCHIVE_PATH
  if (!fullPath.startsWith(safeBase)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── Extension whitelist ───────────────────────────────────────────────────
  const ext = extname(fullPath).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── File existence and type check ─────────────────────────────────────────
  try {
    if (!existsSync(fullPath)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const stat = statSync(fullPath);
    if (!stat.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  // ── Serve the image ───────────────────────────────────────────────────────
  try {
    const data = readFileSync(fullPath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type":  MIME_TYPES[ext] || "image/jpeg",
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Read error", { status: 500 });
  }
}
