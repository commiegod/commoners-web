/**
 * Commoner holder verification.
 *
 * Checks whether a connected wallet holds one or more of the 120 Commoner NFTs
 * (3-trait MidEvils) by querying their SPL token accounts on mainnet and
 * cross-referencing against the known mint list in commoners.json.
 *
 * Returns the number of Commoner NFTs held (voting power = that count).
 */

import commoners from "../data/commoners.json";

// Build a Set of all 120 Commoner mint addresses for O(1) lookup.
const COMMONER_MINTS = new Set(commoners.nfts.map((n) => n.id));

const MAINNET_RPC =
  process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

/**
 * Returns how many Commoner NFTs the given wallet holds (0 = not a holder).
 * @param {string} walletAddress  Base58 public key string
 */
export async function getCommonerCount(walletAddress) {
  try {
    // Fetch all SPL token accounts owned by this wallet
    const res = await fetch(MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed" },
        ],
      }),
    });

    const json = await res.json();
    const accounts = json.result?.value ?? [];

    let count = 0;
    for (const acct of accounts) {
      const info = acct.account?.data?.parsed?.info;
      // NFT: decimals=0, amount="1"
      if (
        info?.tokenAmount?.decimals === 0 &&
        info?.tokenAmount?.amount === "1" &&
        COMMONER_MINTS.has(info.mint)
      ) {
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Governance thresholds per proposal type and treasury amount.
 *
 * From governance-v1.2:
 *   Standard:           51% majority, 20% quorum (24/120 NFTs)
 *   Treasury < 5 SOL:   51% majority, 20% quorum (24/120 NFTs)
 *   Treasury 5-20 SOL:  67% supermajority, 30% quorum (36/120 NFTs)
 *   Treasury > 20 SOL:  75% supermajority + futarchy (Phase 4)
 */
export const TOTAL_NFTS = 120;

export const PROPOSAL_TYPES = {
  "common-threshold": {
    label: "COMMON Threshold",
    description: "Set or change the COMMON token balance that unlocks zero auction fees.",
    treasury: false,
  },
  "community-initiative": {
    label: "Community Initiative",
    description: "Non-financial proposals: partnerships, recognition, campaigns.",
    treasury: false,
  },
  "parameter-change": {
    label: "Parameter Change",
    description: "Modify a system parameter: fee tiers, quorum thresholds, durations, caps.",
    treasury: false,
  },
  "governance-experiment": {
    label: "Governance Experiment",
    description: "Trial a new governance mechanism for a fixed period (typically 30 days).",
    treasury: false,
  },
  "daily-highlight-bounty": {
    label: "Daily Highlight Bounty",
    description: "Post an open artist bounty tied to a specific upcoming auction date.",
    treasury: false,
  },
  "treasury-grant": {
    label: "Treasury Grant",
    description: "Fund a project, creator, initiative, or cause from the treasury.",
    treasury: true,
  },
  "builder-bounty": {
    label: "Builder Bounty",
    description: "Commission a specific deliverable: tool, art, merchandise. Payment on delivery.",
    treasury: true,
  },
  "local-impact": {
    label: "Local Impact Initiative",
    description: "Direct treasury funds or community energy toward real-world local impact.",
    treasury: true,
  },
};

export function getThresholds(type, treasurySol = 0) {
  const isTreasury = PROPOSAL_TYPES[type]?.treasury ?? false;

  if (!isTreasury || treasurySol === 0) {
    return { majority: 51, quorum: 24, needsFutarchy: false };
  }
  if (treasurySol > 20) {
    return { majority: 75, quorum: 36, needsFutarchy: true };
  }
  if (treasurySol >= 5) {
    return { majority: 67, quorum: 36, needsFutarchy: false };
  }
  return { majority: 51, quorum: 24, needsFutarchy: false };
}

/** Returns ms remaining until deadline, or 0 if past. */
export function msRemaining(endsAt) {
  return Math.max(0, new Date(endsAt).getTime() - Date.now());
}

export function formatTimeLeft(endsAt) {
  const ms = msRemaining(endsAt);
  if (ms === 0) return "Ended";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}
