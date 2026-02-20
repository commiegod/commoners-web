/**
 * Computes rarity scores and ranks for the 120 Commoners using the
 * standard trait-rarity formula (sum of 1/trait_frequency for each trait).
 * Saves results to data/rarity.json.
 *
 * Run from the web/ directory:
 *   node scripts/compute-rarity.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const { nfts, totalCommoners } = JSON.parse(
  readFileSync(join(__dir, "../data/commoners.json"), "utf8")
);

const TOTAL = totalCommoners; // 120

// Count occurrences of each trait_type:value pair
const traitCounts = {};
for (const nft of nfts) {
  for (const { trait_type, value } of nft.traits) {
    const key = `${trait_type}::${value}`;
    traitCounts[key] = (traitCounts[key] || 0) + 1;
  }
}

// Score each NFT: sum of (TOTAL / count) for each trait
const scored = nfts.map((nft) => {
  const score = nft.traits.reduce((acc, { trait_type, value }) => {
    const key = `${trait_type}::${value}`;
    return acc + TOTAL / traitCounts[key];
  }, 0);
  return { id: nft.id, name: nft.name, score };
});

// Sort descending by score → rank 1 = rarest
scored.sort((a, b) => b.score - a.score);

const rankings = {};
scored.forEach((item, idx) => {
  rankings[item.id] = {
    rank: idx + 1,
    score: Math.round(item.score * 100) / 100,
  };
});

// Print top 10 for verification
console.log("Top 10 rarest Commoners:");
scored.slice(0, 10).forEach((item, idx) => {
  console.log(`  #${idx + 1}  ${item.name}  (score: ${item.score.toFixed(2)})`);
});

const out = {
  generatedAt: new Date().toISOString(),
  method: "sum of (N / trait_count) per trait, ranked within 120 Commoners",
  total: TOTAL,
  rankings,
};

const outPath = join(__dir, "../data/rarity.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\nWrote ${outPath}`);
