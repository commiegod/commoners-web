// POST /api/admin/add-tweet
//
// Appends a curated tweet entry to data/midevils/top_tweets/top_tweets_registry.json.
// The Town Crier strip on the homepage filters that registry to entries with
// at least one image and renders the most recent five.
//
// Request body: { url, image, date? }
//   url   — full tweet URL (x.com or twitter.com, with /status/<id>)
//   image — direct media URL (typically pbs.twimg.com/...) the strip will display
//   date  — optional ISO timestamp; defaults to now (so newest curation pops to front)
//
// Auth: Bearer <ADMIN_SECRET>, matching the rest of /api/admin/*.

import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../lib/githubApi";

const REGISTRY_PATH = "data/midevils/top_tweets/top_tweets_registry.json";

// Captures username + tweet id from x.com / twitter.com / mobile variants.
const TWEET_URL_RE =
  /^https?:\/\/(?:(?:www|mobile)\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d+)/i;

function authorized(request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  return token && token === process.env.ADMIN_SECRET;
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = (body?.url || "").trim();
  const image = (body?.image || "").trim();
  const customDate = (body?.date || "").trim();

  // Tweet URL validation + parse.
  const match = url.match(TWEET_URL_RE);
  if (!match) {
    return NextResponse.json(
      {
        error:
          "Tweet URL must look like https://x.com/<username>/status/<id>",
      },
      { status: 400 }
    );
  }
  const username = match[1];
  const id = match[2];

  // Image URL validation — we just require it to be https. Twitter media
  // domains (pbs.twimg.com, video.twimg.com) all qualify; we don't lock to
  // a specific host so screenshots hosted elsewhere still work if needed.
  if (!/^https:\/\/\S+\.\S+/i.test(image)) {
    return NextResponse.json(
      { error: "Image URL must be a full https://… link." },
      { status: 400 }
    );
  }

  // Date: use provided ISO if given and parseable, else now.
  let date;
  if (customDate) {
    const d = new Date(customDate);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "Date must be a valid ISO timestamp." },
        { status: 400 }
      );
    }
    date = d.toISOString();
  } else {
    date = new Date().toISOString();
  }

  // Normalize the URL we persist so the registry isn't littered with
  // tracking params or twitter.com vs x.com inconsistencies.
  const cleanUrl = `https://x.com/${username}/status/${id}`;

  // ── Read registry ──────────────────────────────────────────────────────────
  const { content: existing, sha } = await getFile(REGISTRY_PATH);
  const list = Array.isArray(existing) ? existing : [];

  // De-dupe by tweet id — if the user re-adds the same tweet, update its
  // image and date in place rather than create a duplicate row.
  const idx = list.findIndex((e) => e?.id === id);
  const entry = {
    id,
    url: cleanUrl,
    username,
    text: "",
    date,
    likes: 0,
    views: 0,
    reposts: 0,
    replies: 0,
    images: [image],
  };

  if (idx >= 0) {
    list[idx] = { ...list[idx], ...entry };
  } else {
    list.push(entry);
  }

  await putFile(
    REGISTRY_PATH,
    list,
    sha,
    `crier: add tweet @${username}/${id}`
  );

  return NextResponse.json({ ok: true, entry });
}
