/**
 * Graveyard sync utility.
 *
 * Fetches all assets in the MidEvil Graveyard soulbound collection via Helius
 * DAS, then cross-references against the 120 known Commoner mints to identify
 * which burned tokens were originally Commoner NFTs.
 *
 * Returns an array of BurnedCommoner objects sorted by burn date (oldest first).
 */

import commonersData from "../data/commoners.json";

const GRAVEYARD_COLLECTION = "DpYLtgV5XcWPt3TM9FhXEh8uNg6QFYrj3zCGZxpcA3vF";

const MAINNET_RPC =
  process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

/**
 * Extract the MidEvil number from a name like "MidEvil #1542" → 1542.
 * Returns null if no match.
 */
function extractNumber(name) {
  const m = name?.match(/#(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Build a lookup map: MidEvil number → original Commoner entry
const COMMONER_BY_NUMBER = {};
for (const nft of commonersData.nfts) {
  const n = extractNumber(nft.name);
  if (n !== null) COMMONER_BY_NUMBER[n] = nft;
}

/**
 * Fetches all assets in the Graveyard collection, paginates if needed,
 * and returns only those that correspond to Commoner NFTs.
 *
 * @returns {Promise<Array<{
 *   graveyardMint: string,
 *   originalMint:  string,
 *   name:          string,
 *   number:        number,
 *   image:         string,
 *   traits:        Array<{trait_type: string, value: string}>,
 *   owner:         string,
 *   burnedAt:      string|null,
 * }>>}
 */
export async function fetchBurnedCommoners() {
  let allItems = [];

  // Paginate through the entire Graveyard collection
  let page = 1;
  while (true) {
    const res = await fetch(MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "graveyard-sync",
        method: "getAssetsByGroup",
        params: {
          groupKey: "collection",
          groupValue: GRAVEYARD_COLLECTION,
          page,
          limit: 1000,
          displayOptions: {
            showFungible: false,
            showNativeBalance: false,
            showCollectionMetadata: false,
          },
        },
      }),
      // Server-side fetch — allow Next.js to cache/revalidate
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`Helius DAS error: ${res.status}`);

    const json = await res.json();
    const items = json.result?.items ?? [];
    allItems = allItems.concat(items);
    if (items.length < 1000) break;
    page++;
  }

  // Filter to only Graveyard tokens that were originally Commoners.
  // Must match both the number AND the "MidEvil" name prefix — other
  // sub-collections (Orcs, Beasts, etc.) share the same number space.
  const burned = [];
  for (const asset of allItems) {
    const name = asset.content?.metadata?.name ?? "";
    if (!name.toLowerCase().startsWith("midevil")) continue;

    const number = extractNumber(name);
    if (number === null) continue;

    const originalCommoner = COMMONER_BY_NUMBER[number];
    if (!originalCommoner) continue; // Not a Commoner — skip

    // Pull image: prefer the Graveyard token's own image (may be grayscale),
    // fall back to the original Commoner image
    const graveyardImage =
      asset.content?.links?.image ||
      asset.content?.files?.[0]?.uri ||
      null;

    // Pull traits from Graveyard token metadata attributes
    const rawAttrs = asset.content?.metadata?.attributes ?? [];
    const traits = rawAttrs.map((a) => ({
      trait_type: a.trait_type ?? a.traitType ?? "",
      value: String(a.value ?? ""),
    }));

    // Burn date: use the Graveyard token's creation timestamp if available
    const burnedAt = asset.created_at
      ? new Date(asset.created_at * 1000).toISOString()
      : null;

    burned.push({
      graveyardMint: asset.id,
      originalMint: originalCommoner.id,
      name: originalCommoner.name,
      number,
      // Show Graveyard image if available, else fall back to original
      image: graveyardImage ?? originalCommoner.image,
      originalImage: originalCommoner.image,
      traits: traits.length > 0 ? traits : originalCommoner.traits,
      owner: asset.ownership?.owner ?? "",
      burnedAt,
    });
  }

  // Sort by burn date ascending (oldest first), nulls last
  burned.sort((a, b) => {
    if (!a.burnedAt && !b.burnedAt) return a.number - b.number;
    if (!a.burnedAt) return 1;
    if (!b.burnedAt) return -1;
    return new Date(a.burnedAt) - new Date(b.burnedAt);
  });

  return burned;
}
