/**
 * Graveyard sync utility.
 *
 * Determines which of the 120 known Commoner mints have been burned by
 * batch-querying them directly via Helius DAS getAssets and checking the
 * `burnt` flag. This is the only reliable method — name/number matching
 * against the Graveyard collection fails because other sub-collections
 * (Orcs, Beasts) share the same number space and their soulbound tokens
 * can have colliding names.
 *
 * For each burned Commoner, a secondary lookup finds the corresponding
 * Graveyard soulbound token (for the on-chain link) by searching the
 * Graveyard collection for a token whose name matches the Commoner's name.
 *
 * Returns an array of BurnedCommoner objects sorted by burn date (oldest first).
 */

import commonersData from "../data/commoners.json";

const GRAVEYARD_COLLECTION = "DpYLtgV5XcWPt3TM9FhXEh8uNg6QFYrj3zCGZxpcA3vF";

const MAINNET_RPC =
  process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

/**
 * Step 1: Batch-fetch all 120 Commoner mints and return those marked burnt.
 * Uses Helius DAS getAssets (up to 1000 IDs per call).
 */
async function fetchBurntCommoners() {
  const ids = commonersData.nfts.map((n) => n.id);

  const res = await fetch(MAINNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "commoner-burnt-check",
      method: "getAssets",
      params: {
        ids,
        displayOptions: {
          showFungible: false,
          showNativeBalance: false,
        },
      },
    }),
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`Helius DAS getAssets error: ${res.status}`);

  const json = await res.json();
  const assets = json.result ?? [];

  // Return only those explicitly marked as burned
  return assets.filter((a) => a.burnt === true);
}

/**
 * Step 2: Fetch the Graveyard soulbound collection and build a name → token
 * lookup so we can attach the graveyard mint address to each burned Commoner.
 */
async function fetchGraveyardIndex() {
  const index = {}; // name (lowercase) → graveyard asset
  let page = 1;

  while (true) {
    const res = await fetch(MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "graveyard-index",
        method: "getAssetsByGroup",
        params: {
          groupKey: "collection",
          groupValue: GRAVEYARD_COLLECTION,
          page,
          limit: 1000,
          displayOptions: { showFungible: false, showNativeBalance: false },
        },
      }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) break; // Non-fatal — graveyard links just won't appear

    const json = await res.json();
    const items = json.result?.items ?? [];

    for (const item of items) {
      const name = item.content?.metadata?.name;
      if (name) index[name.toLowerCase()] = item;
    }

    if (items.length < 1000) break;
    page++;
  }

  return index;
}

/**
 * Main export. Returns burned Commoners with full metadata, sorted oldest first.
 *
 * @returns {Promise<Array<{
 *   graveyardMint: string|null,
 *   originalMint:  string,
 *   name:          string,
 *   number:        number,
 *   image:         string,
 *   traits:        Array<{trait_type: string, value: string}>,
 *   burnedAt:      string|null,
 * }>>}
 */
export async function fetchBurnedCommoners() {
  // Run both fetches in parallel
  const [burntAssets, graveyardIndex] = await Promise.all([
    fetchBurntCommoners(),
    fetchGraveyardIndex(),
  ]);

  // Build a mint → original Commoner entry map for quick lookup
  const commoners = Object.fromEntries(
    commonersData.nfts.map((n) => [n.id, n])
  );

  const burned = [];

  for (const asset of burntAssets) {
    const original = commoners[asset.id];
    if (!original) continue; // Shouldn't happen, but guard anyway

    // Find the matching Graveyard soulbound token by name
    const graveyardAsset = graveyardIndex[original.name.toLowerCase()] ?? null;
    const graveyardMint = graveyardAsset?.id ?? null;

    // Burn date from Graveyard token creation timestamp
    const burnedAt = graveyardAsset?.created_at
      ? new Date(graveyardAsset.created_at * 1000).toISOString()
      : null;

    const number = parseInt(original.name.match(/#(\d+)/)?.[1] ?? "0", 10);

    burned.push({
      graveyardMint,
      originalMint: original.id,
      name: original.name,
      number,
      image: original.image, // Use original Commoner image — definitive
      traits: original.traits,
      burnedAt,
    });
  }

  // Sort by burn date ascending (oldest first), unknown dates last
  burned.sort((a, b) => {
    if (!a.burnedAt && !b.burnedAt) return a.number - b.number;
    if (!a.burnedAt) return 1;
    if (!b.burnedAt) return -1;
    return new Date(a.burnedAt) - new Date(b.burnedAt);
  });

  return burned;
}
