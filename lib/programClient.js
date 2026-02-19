import { Connection, PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import BN from "bn.js";
import idl from "./idl.json";

export const PROGRAM_ID = new PublicKey(
  "EWXiRHrYNtMy6wXQsy2oZhops6Dsw5M4GT59Bqb3xPjC"
);
export const RPC_URL = "https://api.devnet.solana.com";

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
