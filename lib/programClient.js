import { Connection, PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import BN from "bn.js";
import idl from "./idl.json";

export const PROGRAM_ID = new PublicKey(
  "EWXiRHrYNtMy6wXQsy2oZhops6Dsw5M4GT59Bqb3xPjC"
);
export const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "https://api.devnet.solana.com";

export function getConnection() {
  return new Connection(RPC_URL, "confirmed");
}

function bnToLeBuffer(value) {
  return new BN(value.toString()).toArrayLike(Buffer, "le", 8);
}

export function configPDA() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("program-config")],
    PROGRAM_ID
  );
}

export function auctionPDA(auctionId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("auction"), bnToLeBuffer(auctionId)],
    PROGRAM_ID
  );
}

export function bidVaultPDA(auctionId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bid-vault"), bnToLeBuffer(auctionId)],
    PROGRAM_ID
  );
}

// AuctionState size: 8 (disc) + 32 + 32 + 8 + 8 + 8 + 8 + 33 + 2 + 1 + 1 + 8 + 1 = 150
const AUCTION_STATE_SIZE = 150;

export async function findAuctionByMint(connection, mintPubkey) {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: AUCTION_STATE_SIZE },
      { memcmp: { offset: 8, bytes: mintPubkey.toBase58() } },
    ],
  });

  if (accounts.length === 0) return null;

  const coder = new BorshAccountsCoder(idl);

  // Prefer the active (unsettled) auction if multiple exist
  for (const { pubkey, account } of accounts) {
    const state = coder.decode("AuctionState", account.data);
    if (!state.settled) {
      return { pubkey, state };
    }
  }

  // Return the most recently settled one if all are settled
  const { pubkey, account } = accounts[accounts.length - 1];
  return { pubkey, state: coder.decode("AuctionState", account.data) };
}

/**
 * Compute the minimum next bid in lamports.
 * Mirrors the on-chain `min_next_bid` logic.
 *   bid_increment_bps defaults to 500 (5%).
 */
export function computeMinNextBid(auctionState, bidIncrementBps = 500) {
  const current = auctionState.currentBid;
  if (current.isZero()) {
    return auctionState.reservePrice;
  }
  const increment = current
    .mul(new BN(bidIncrementBps))
    .div(new BN(10_000));
  return current.add(increment);
}

// ── SlotRegistration discovery ───────────────────────────────────────────────
//
// Account layout (91 bytes):
// [0-7]   discriminator
// [8-39]  nft_mint (pubkey)
// [40-71] owner (pubkey)
// [72-79] scheduled_date (i64 LE, unix seconds)
// [80-87] reserve_price (u64 LE, lamports)
// [88]    escrowed (bool)
// [89]    consumed (bool)
// [90]    bump (u8)

const SLOT_DISCRIMINATOR = [119, 114, 239, 196, 78, 13, 64, 243];
const SLOT_SIZE = 91;

export async function fetchSlotAccounts(connection) {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: SLOT_SIZE }],
  });
  const coder = new BorshAccountsCoder(idl);
  return accounts
    .filter(({ account }) =>
      SLOT_DISCRIMINATOR.every((b, i) => account.data[i] === b)
    )
    .map(({ pubkey, account }) => {
      const state = coder.decode("SlotRegistration", account.data);
      const ts = state.scheduledDate.toNumber();
      return {
        pubkey,
        nftMint: state.nftMint.toBase58(),
        owner: state.owner.toBase58(),
        scheduledDate: ts,
        dateStr: new Date(ts * 1000).toISOString().split("T")[0],
        reservePrice: state.reservePrice,
        escrowed: state.escrowed,
        consumed: state.consumed,
      };
    });
}

export async function fetchMetadataBatch(mints) {
  if (!mints.length) return [];
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "batch",
        method: "getAssetBatch",
        params: { ids: mints },
      }),
    });
    const json = await res.json();
    return json.result || [];
  } catch {
    return [];
  }
}

export function slotPDA(nftMint, scheduledDate) {
  // seeds: ["slot", nft_mint, scheduled_date as i64 LE]
  return PublicKey.findProgramAddressSync(
    [Buffer.from("slot"), nftMint.toBuffer(), bnToLeBuffer(scheduledDate)],
    PROGRAM_ID
  );
}
