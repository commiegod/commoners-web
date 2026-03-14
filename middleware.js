import { NextResponse } from "next/server";

/**
 * Edge middleware — per-IP rate limiting on write endpoints.
 *
 * Uses an in-memory Map. Not persistent across Vercel function instances
 * (degrades gracefully: each warm instance enforces its own window), but
 * provides meaningful protection within a single instance and is far better
 * than nothing for a small-scale launch.
 *
 * If the store grows too large (many unique IPs), it is cleared to prevent
 * unbounded memory use — this resets all counters, which is acceptable.
 */

const WINDOW_MS = 60_000; // 1-minute sliding window
const MAX_STORE_SIZE = 5_000;

// POST limits per path: max requests per IP per WINDOW_MS
const POST_LIMITS = {
  "/api/bracket/entries": 5,
  "/api/discussion": 10,
  "/api/discussion/reply": 10,
  "/api/bounty-submit": 3,
  "/api/governance-submit": 5,
};

const store = new Map(); // key: "ip:method:path" → { count, resetAt }

function isRateLimited(ip, method, pathname) {
  const max = method === "POST" ? POST_LIMITS[pathname] : null;
  if (!max) return false;

  if (store.size > MAX_STORE_SIZE) store.clear();

  const key = `${ip}:${method}:${pathname}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}

export function middleware(request) {
  const { method, nextUrl } = request;
  const ip =
    request.ip ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (isRateLimited(ip, method, nextUrl.pathname)) {
    return NextResponse.json(
      { error: "Too many requests — please slow down." },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/bracket/entries",
    "/api/bounty-submit",
    "/api/discussion",
    "/api/discussion/reply",
    "/api/governance-submit",
  ],
};
