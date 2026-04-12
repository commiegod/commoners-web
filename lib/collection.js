/**
 * MidEvils collection utilities.
 *
 * Single source of truth for Commoner detection. A Commoner is any non-burned
 * MidEvil with exactly 3 non-"None" traits (Background, Skin, + one more).
 *
 * This replaces the static commoners.json approach so that saved PrimeVils
 * (which join the MidEvils collection with varying trait counts) are handled
 * automatically — no manual list maintenance required.
 *
 * Server-side only. Uses Next.js fetch caching (revalidate: 3600).
 */

import commonersFallback from "../data/commoners.json";

export const MIDEVILS_COLLECTION = "w44WvLKRdLGye2ghhDJBxcmnWpBo31A1tCBko2G6DgW";

const MAINNET_RPC =
  process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

/**
 * Returns true if an asset is a Commoner — exactly 3 non-"None" traits.
 */
function isCommoner(asset) {
  const attrs = asset.content?.metadata?.attributes ?? [];
  const active = attrs.filter(
    (a) => a.value && a.value.toLowerCase() !== "none"
  );
  return active.length === 3;
}

/**
 * Normalises a raw Helius DAS asset into the shape the rest of the site uses.
 */
function normaliseAsset(asset) {
  const attrs = asset.content?.metadata?.attributes ?? [];
  const traits = attrs
    .filter((a) => a.value && a.value.toLowerCase() !== "none")
    .map((a) => ({ trait_type: a.trait_type, value: a.value }));

  // Prefer cdn/arweave image; fall back through known Helius response shapes
  const image =
    asset.content?.links?.image ??
    asset.content?.files?.find((f) => f.mime?.startsWith("image/"))?.uri ??
    asset.content?.files?.[0]?.uri ??
    "";

  return {
    id: asset.id,
    name: asset.content?.metadata?.name ?? "",
    image,
    traits,
    owner: asset.ownership?.owner ?? "",
  };
}

/**
 * Fetches all active (non-burned) Commoner NFTs from the MidEvils on-chain
 * collection. Paginates through the full collection and filters for 3-trait
 * assets. Automatically includes saved PrimeVils once they join the collection.
 *
 * Falls back to commoners.json if Helius is unreachable.
 *
 * @returns {Promise<Array<{id, name, image, traits, owner}>>}
 */
export async function fetchAllActiveCommoners() {
  if (!MAINNET_RPC.includes("helius")) {
    // Not on Helius — return static fallback
    return commonersFallback.nfts;
  }

  try {
    const commoners = [];
    let page = 1;

    while (true) {
      const res = await fetch(MAINNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "commoners-collection-fetch",
          method: "getAssetsByGroup",
          params: {
            groupKey: "collection",
            groupValue: MIDEVILS_COLLECTION,
            page,
            limit: 1000,
            displayOptions: { showFungible: false, showNativeBalance: false },
          },
        }),
        next: { revalidate: 3600 },
      });

      if (!res.ok) throw new Error(`Helius DAS error: ${res.status}`);

      const json = await res.json();
      const items = json.result?.items ?? [];

      for (const item of items) {
        if (item.burnt) continue; // burned — not eligible
        if (!isCommoner(item)) continue; // 4+ traits — not a Commoner
        commoners.push(normaliseAsset(item));
      }

      if (items.length < 1000) break;
      page++;
    }

    // If Helius returned nothing (e.g. RPC issue), fall back to static list
    if (commoners.length === 0) return commonersFallback.nfts;

    return commoners;
  } catch {
    // Helius unreachable — serve stale static data rather than a broken page
    return commonersFallback.nfts;
  }
}
