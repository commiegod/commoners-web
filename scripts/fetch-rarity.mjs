/**
 * Fetches rarity rankings from howrare.is for all 120 Commoners and saves
 * the result to data/rarity.json.
 *
 * Run from the web/ directory:
 *   node scripts/fetch-rarity.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const commoners = JSON.parse(readFileSync(join(__dir, "../data/commoners.json"), "utf8"));

const COMMONER_MINTS = new Set(commoners.nfts.map((n) => n.id));
const COLLECTION = "midevils";
const BASE = `https://api.howrare.is/v0.1/collections/${COLLECTION}`;
const LIMIT = 500;

console.log(`Fetching rarity for ${COMMONER_MINTS.size} Commoner mints from howrare.is…`);

const rarityMap = {}; // mint → { rank, rankAlgo }
let offset = 0;
let totalFetched = 0;
let totalItems = null;

while (true) {
  const url = `${BASE}?limit=${LIMIT}&offset=${offset}`;
  console.log(`  GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} at offset ${offset}`);
  const json = await res.json();

  const data = json.result?.data;
  if (!data) throw new Error("Unexpected response shape");

  const items = data.items ?? [];
  if (totalItems === null && data.paging) {
    totalItems = data.paging.total ?? null;
    console.log(`  Total collection size: ${totalItems ?? "unknown"}`);
  }

  for (const item of items) {
    if (COMMONER_MINTS.has(item.mint)) {
      rarityMap[item.mint] = {
        rank: item.rank,
        rankAlgo: item.rank_algo,
        allRanks: item.all_ranks ?? {},
      };
    }
  }

  totalFetched += items.length;
  console.log(`  Fetched ${totalFetched} items, matched ${Object.keys(rarityMap).length}/${COMMONER_MINTS.size} Commoners so far`);

  // Stop if we've matched all Commoners or reached the end
  if (Object.keys(rarityMap).length >= COMMONER_MINTS.size) {
    console.log("  All Commoners matched — stopping early.");
    break;
  }
  if (items.length < LIMIT) {
    console.log("  Last page reached.");
    break;
  }

  offset += LIMIT;
  // Small delay to be polite
  await new Promise((r) => setTimeout(r, 300));
}

const missing = [...COMMONER_MINTS].filter((m) => !rarityMap[m]);
if (missing.length > 0) {
  console.warn(`WARNING: ${missing.length} Commoner mints not found on howrare.is:`);
  missing.forEach((m) => console.warn(`  ${m}`));
}

const out = {
  generatedAt: new Date().toISOString(),
  source: `https://howrare.is/${COLLECTION}`,
  count: Object.keys(rarityMap).length,
  rankings: rarityMap,
};

const outPath = join(__dir, "../data/rarity.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\nWrote ${outPath} with ${out.count} entries.`);
