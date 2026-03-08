/**
 * MidEvils holder verification.
 *
 * Checks whether a connected wallet holds one or more MidEvils NFTs
 * by querying the Helius DAS getAssetsByOwner API on mainnet and
 * filtering by the MidEvils collection grouping key.
 *
 * Returns the count of MidEvils NFTs held by the wallet.
 */

const MIDEVILS_COLLECTION = "w44WvLKRdLGye2ghhDJBxcmnWpBo31A1tCBko2G6DgW";

const MAINNET_RPC =
  process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

/**
 * Returns how many MidEvils NFTs the given wallet holds (0 = not a holder).
 * Uses the Helius DAS getAssetsByOwner API filtered by collection grouping.
 *
 * @param {string} walletAddress  Base58 public key string
 * @returns {Promise<number>}
 */
export async function getMidEvilCount(walletAddress) {
  if (!walletAddress) return 0;

  // ── Primary: Helius DAS getAssetsByOwner ─────────────────────────────────
  if (MAINNET_RPC.includes("helius")) {
    try {
      let page = 1;
      let count = 0;
      while (true) {
        const res = await fetch(MAINNET_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "midevil-check",
            method: "getAssetsByOwner",
            params: {
              ownerAddress: walletAddress,
              page,
              limit: 1000,
              displayOptions: { showFungible: false, showNativeBalance: false },
            },
          }),
        });
        const json = await res.json();
        const items = json.result?.items ?? [];
        count += items.filter((a) =>
          a.grouping?.some(
            (g) =>
              g.group_key === "collection" &&
              g.group_value === MIDEVILS_COLLECTION
          )
        ).length;
        if (items.length < 1000) break;
        page++;
      }
      return count;
    } catch {
      // fall through to legacy method
    }
  }

  // ── Fallback: getAssetsByGroup (collection-scoped query) ──────────────────
  try {
    const res = await fetch(MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "midevil-group-check",
        method: "getAssetsByGroup",
        params: {
          groupKey: "collection",
          groupValue: MIDEVILS_COLLECTION,
          page: 1,
          limit: 1000,
        },
      }),
    });
    const json = await res.json();
    const items = json.result?.items ?? [];
    // Filter by ownership
    return items.filter(
      (a) => a.ownership?.owner === walletAddress
    ).length;
  } catch {
    return 0;
  }
}
