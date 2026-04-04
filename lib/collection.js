/**
 * MidEvils collection utilities.
 *
 * Source of truth for active Commoner detection. Uses a hybrid approach:
 *
 *   1. commoners.json (static baseline) — the authoritative list of original
 *      Commoners, including any 1/1s or NFTs with unusual on-chain trait
 *      structures that Helius might mis-count. These are never dropped.
 *
 *   2. Helius dynamic query — discovers NEW 3-trait MidEvils (saved PrimeVils)
 *      that have joined the collection since the last snapshot. Anything not
 *      already in commoners.json gets added automatically.
 *
 *   3. Burned mints are excluded from both sources.
 *
 * Server-side only. Uses Next.js fetch caching (revalidate: 3600).
 */

import commonersData from "../data/commoners.json";

export const MIDEVILS_COLLECTION = "w44WvLKRdLGye2ghhDJBxcmnWpBo31A1tCBko2G6DgW";

const MAINNET_RPC =
  process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

/**
 * Returns true if a Helius DAS asset has exactly 3 non-"None" traits.
 * Used only to identify NEW Commoners not already in commoners.json.
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
 * Fetches the set of burned Commoner mint addresses by batch-querying the
 * known Commoner mints via Helius getAssets and checking the burnt flag.
 */
async function fetchBurnedMints() {
  const ids = commonersData.nfts.map((n) => n.id);
  try {
    const res = await fetch(MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "burned-check",
        method: "getAssets",
        params: {
          ids,
          displayOptions: { showFungible: false, showNativeBalance: false },
        },
      }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return new Set();
    const json = await res.json();
    const assets = json.result ?? [];
    return new Set(assets.filter((a) => a.burnt === true).map((a) => a.id));
  } catch {
    return new Set();
  }
}

/**
 * Fetches new 3-trait MidEvils not already in the static Commoner list.
 * These are saved PrimeVils that have joined the collection since the last
 * commoners.json snapshot.
 */
async function fetchNewCommoners(knownIds) {
  const newCommoners = [];
  let page = 1;

  while (true) {
    const res = await fetch(MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "new-commoners-fetch",
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

    if (!res.ok) break;

    const json = await res.json();
    const items = json.result?.items ?? [];

    for (const item of items) {
      if (item.burnt) continue;
      if (knownIds.has(item.id)) continue; // already in commoners.json
      if (!isCommoner(item)) continue; // 4+ traits — not a Commoner
      newCommoners.push(normaliseAsset(item));
    }

    if (items.length < 1000) break;
    page++;
  }

  return newCommoners;
}

/**
 * Returns all active Commoner NFTs — original 120 (minus burns) plus any new
 * 3-trait MidEvils that have joined the collection since the last snapshot.
 *
 * @returns {Promise<Array<{id, name, image, traits, owner}>>}
 */
export async function fetchAllActiveCommoners() {
  if (!MAINNET_RPC.includes("helius")) {
    return commonersData.nfts;
  }

  try {
    const knownIds = new Set(commonersData.nfts.map((n) => n.id));

    // Run burn check and new-Commoner discovery in parallel
    const [burnedMints, newCommoners] = await Promise.all([
      fetchBurnedMints(),
      fetchNewCommoners(knownIds),
    ]);

    // Static originals minus burned
    const originals = commonersData.nfts.filter((n) => !burnedMints.has(n.id));

    // New saves minus burned (edge case: saved then immediately burned)
    const newActive = newCommoners.filter((n) => !burnedMints.has(n.id));

    return [...originals, ...newActive];
  } catch {
    return commonersData.nfts;
  }
}
