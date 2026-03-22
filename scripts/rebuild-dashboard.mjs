/**
 * rebuild-dashboard.mjs
 *
 * Regenerates community-tweets-dashboard.html from all tweet sources:
 *   - ~/midevils/archive/meme_registry.json          (Discord-sourced tweets)
 *   - ~/midevils/archive/holder_tweets_registry.json (profile crawl tweets)
 *
 * Marks tweets already in top_tweets_registry / community_highlights_registry
 * as "existing milestones" so they don't show in the picker.
 *
 * Usage:
 *   cd ~/common/web
 *   node scripts/rebuild-dashboard.mjs
 *
 * Then open scripts/community-tweets-dashboard.html in your browser.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import os from "os";

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ARCHIVE    = resolve(os.homedir(), "midevils/archive");
const WEB_DATA   = resolve(__dirname, "../data/midevils/top_tweets");
const DASH_PATH  = resolve(__dirname, "community-tweets-dashboard.html");

// ── Load sources ──────────────────────────────────────────────────────────────

function loadJson(path, fallback = []) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

const memeReg    = loadJson(resolve(ARCHIVE, "meme_registry.json"));
const holderReg  = loadJson(resolve(ARCHIVE, "holder_tweets_registry.json"));
const milestones = loadJson(resolve(ARCHIVE, "top_tweets/top_tweets_registry.json"));
const artistReg  = loadJson(resolve(ARCHIVE, "top_tweets/artist_tweets_registry.json"));
const highlights = loadJson(resolve(ARCHIVE, "top_tweets/community_highlights_registry.json"));

console.log(`📋  meme_registry:    ${memeReg.length} entries`);
console.log(`📋  holder_registry:  ${holderReg.length} entries`);
console.log(`📋  milestones:       ${milestones.length} entries`);
console.log(`📋  artist tweets:    ${artistReg.length} entries`);
console.log(`📋  highlights:       ${highlights.length} entries`);

// ── IDs already used in curated sections ─────────────────────────────────────
// These are excluded from the picker — no point re-selecting them

const extractId = (t) => (t.tweet_id ?? (t.url ?? "").match(/\/status\/(\d+)/)?.[1] ?? null);

const milestoneIds = new Set([
  ...milestones.map(extractId),
  ...artistReg.map(extractId),
  ...highlights.map(extractId),
].filter(Boolean));

// Next available index for community highlight screenshot filenames
// (based on highest numbered filename in highlights registry)
const allScreenshots = highlights.map(t => t.screenshot).filter(Boolean);
const maxIdx = allScreenshots.reduce((max, name) => {
  const m = name.match(/^(\d+)_/);
  return m ? Math.max(max, parseInt(m[1])) : max;
}, 22); // default floor of 22 (current highest)
const nextIdx = maxIdx + 1;

console.log(`📋  ${milestoneIds.size} milestone IDs to exclude`);
console.log(`📋  Next screenshot index: ${nextIdx}\n`);

// ── Combine and deduplicate ───────────────────────────────────────────────────

const seen    = new Set();
const combined = [];

for (const entry of [...memeReg, ...holderReg]) {
  const id = entry.tweet_id;
  if (!id || seen.has(id)) continue;
  if (!entry.img_url)       continue;
  if ((entry.score ?? 0) < 2) continue;
  seen.add(id);
  combined.push(entry);
}

// Sort by score descending
combined.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

// Normalize to dashboard-friendly shape
const dashTweets = combined.map(e => ({
  username:  e.username ?? "",
  tweet_url: e.tweet_url ?? `https://x.com/i/status/${e.tweet_id}`,
  img_url:   e.img_url,
  date:      e.date ?? "",
  likes:     e.likes    ?? 0,
  reposts:   e.reposts  ?? 0,
  replies:   e.replies  ?? 0,
  views:     e.views    ?? 0,
  score:     e.score    ?? 0,
  tweet_id:  e.tweet_id,
  source:    e.source ?? "discord",
}));

console.log(`✅  ${dashTweets.length} combined unique tweets for dashboard`);

// ── Generate dashboard HTML ───────────────────────────────────────────────────

const milestoneIdsArray = JSON.stringify([...milestoneIds]);
const tweetsJson        = JSON.stringify(dashTweets);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MidEvils — Community Tweet Milestone Picker</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #111; color: #eee; padding: 24px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { color: #888; font-size: 13px; margin-bottom: 20px; }
  .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .toolbar label { color: #aaa; font-size: 13px; }
  .toolbar input[type=range] { width: 140px; accent-color: #7c5cfc; }
  .toolbar span { color: #7c5cfc; font-size: 13px; font-weight: 600; min-width: 30px; }
  .toolbar select { background: #1a1a1a; color: #ccc; border: 1px solid #333; border-radius: 6px; padding: 4px 8px; font-size: 13px; }
  .export-btn { margin-left: auto; background: #7c5cfc; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .export-btn:hover { background: #6b4de0; }
  .count { color: #888; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .card { background: #1a1a1a; border: 2px solid #2a2a2a; border-radius: 10px; overflow: hidden; cursor: pointer; transition: border-color 0.15s, transform 0.1s; position: relative; }
  .card:hover { border-color: #555; transform: translateY(-2px); }
  .card.selected { border-color: #7c5cfc; background: #1a1530; }
  .card.selected .check { opacity: 1; }
  .check { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; background: #7c5cfc; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; opacity: 0; transition: opacity 0.15s; z-index: 2; }
  .source-badge { position: absolute; top: 8px; left: 8px; font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; z-index: 2; }
  .source-discord { background: #5865F2; color: #fff; }
  .source-holder { background: #e8a020; color: #111; }
  .img-wrap { width: 100%; aspect-ratio: 1; background: #222; overflow: hidden; }
  .img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .img-wrap .no-img { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #444; font-size: 12px; }
  .info { padding: 10px 12px 12px; }
  .handle { font-size: 13px; font-weight: 600; color: #bbb; margin-bottom: 4px; }
  .date { font-size: 11px; color: #555; margin-bottom: 8px; }
  .stats { display: flex; gap: 10px; font-size: 11px; color: #666; flex-wrap: wrap; }
  .stats .score { color: #7c5cfc; font-weight: 700; font-size: 12px; }
  .stats span { display: flex; align-items: center; gap: 2px; }
  .view-link { display: inline-block; margin-top: 8px; font-size: 11px; color: #7c5cfc; text-decoration: none; }
  .view-link:hover { text-decoration: underline; }
  .output { margin-top: 28px; background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px; display: none; }
  .output h2 { font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #aaa; }
  .output pre { font-size: 11px; color: #7c5cfc; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
  .selected-bar { position: sticky; bottom: 0; background: #1a1530; border-top: 1px solid #7c5cfc; padding: 12px 24px; display: flex; align-items: center; gap: 12px; margin: 0 -24px -24px; }
  .selected-bar span { font-size: 13px; color: #bbb; }
  .selected-bar strong { color: #7c5cfc; }
</style>
</head>
<body>

<h1>Community Tweet Milestone Picker</h1>
<p class="subtitle">Pick community highlights to feature on the Scrolls page. Artist tweets and milestones are managed separately — only community member posts appear here.</p>
<p class="subtitle" style="margin-top:4px; color:#555">Last rebuilt: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} &nbsp;·&nbsp; ${dashTweets.length} community tweets &nbsp;·&nbsp; ${dashTweets.filter(t => t.source === "holder_crawl").length} from profile crawl &nbsp;·&nbsp; ${dashTweets.filter(t => t.source !== "holder_crawl").length} from Discord</p>

<div class="toolbar">
  <label>Min score: <input type="range" id="scoreFilter" min="0" max="540" value="0" step="10" oninput="updateFilter()"> <span id="scoreVal">0</span></label>
  <label>Source:
    <select id="sourceFilter" onchange="render()">
      <option value="all">All</option>
      <option value="holder_crawl">Profile crawl</option>
      <option value="discord">Discord</option>
    </select>
  </label>
  <span class="count" id="countLabel"></span>
  <button class="export-btn" onclick="exportSelected()">Export Selected →</button>
</div>

<div class="grid" id="grid"></div>
<div class="output" id="output"><h2>Paste into community_highlights_registry.json:</h2><pre id="outputPre"></pre></div>

<div class="selected-bar">
  <span><strong id="selCount">0</strong> selected</span>
  <button class="export-btn" onclick="exportSelected()">Export Selected →</button>
</div>

<script>
const tweets = ${tweetsJson};

const existingIds = new Set(${milestoneIdsArray});
let selected  = new Set();
let minScore  = 0;
let nextIdx   = ${nextIdx};

function slug(username) {
  return username.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function updateFilter() {
  minScore = parseInt(document.getElementById('scoreFilter').value);
  document.getElementById('scoreVal').textContent = minScore;
  render();
}

function render() {
  const sourceFilter = document.getElementById('sourceFilter').value;
  const filtered = tweets.filter(t =>
    t.score >= minScore &&
    !existingIds.has(t.tweet_id) &&
    (sourceFilter === 'all' || t.source === sourceFilter)
  );
  document.getElementById('countLabel').textContent = \`\${filtered.length} tweets\`;
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  filtered.forEach(t => {
    const isSelected = selected.has(t.tweet_id);
    const badgeClass = t.source === 'holder_crawl' ? 'source-holder' : 'source-discord';
    const badgeLabel = t.source === 'holder_crawl' ? 'profile' : 'discord';
    const card = document.createElement('div');
    card.className = 'card' + (isSelected ? ' selected' : '');
    card.innerHTML = \`
      <div class="check">✓</div>
      <div class="source-badge \${badgeClass}">\${badgeLabel}</div>
      <div class="img-wrap">
        <img src="\${t.img_url}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=no-img>no image</div>'" />
      </div>
      <div class="info">
        <div class="handle">@\${t.username}</div>
        <div class="date">\${t.date}</div>
        <div class="stats">
          <span class="score">↑\${t.score}</span>
          <span>♥ \${t.likes}</span>
          <span>🔁 \${t.reposts}</span>
          <span>👁 \${(t.views/1000).toFixed(1)}k</span>
        </div>
        <a class="view-link" href="\${t.tweet_url}" target="_blank" onclick="event.stopPropagation()">View on X →</a>
      </div>\`;
    card.onclick = () => {
      if (selected.has(t.tweet_id)) selected.delete(t.tweet_id);
      else selected.add(t.tweet_id);
      document.getElementById('selCount').textContent = selected.size;
      render();
    };
    grid.appendChild(card);
  });
}

function exportSelected() {
  const picks = tweets.filter(t => selected.has(t.tweet_id));
  if (!picks.length) { alert('Select at least one tweet first.'); return; }
  let idx = nextIdx;
  const entries = picks.map(t => ({
    url:        t.tweet_url,
    username:   t.username,
    text:       "",
    date:       t.date + "T00:00:00.000Z",
    likes:      t.likes,
    views:      t.views,
    reposts:    t.reposts,
    screenshot: String(idx++).padStart(2,'0') + '_' + slug(t.username) + '.png',
  }));
  document.getElementById('outputPre').textContent = JSON.stringify(entries, null, 2);
  const out = document.getElementById('output');
  out.style.display = 'block';
  out.scrollIntoView({ behavior: 'smooth' });
}

render();
document.getElementById('selCount').textContent = '0';
</script>
</body>
</html>`;

writeFileSync(DASH_PATH, html);

console.log(`\n✅  Dashboard rebuilt → scripts/community-tweets-dashboard.html`);
console.log(`   ${dashTweets.length} tweets embedded`);
console.log(`   ${milestoneIds.size} existing milestones excluded`);
console.log(`\nOpen the dashboard:`);
console.log(`   open scripts/community-tweets-dashboard.html`);
