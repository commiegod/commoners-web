"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import idl from "../../lib/idl.json";
import {
  configPDA,
  bidVaultPDA,
  computeMinNextBid,
  PROGRAM_ID,
  RPC_URL,
} from "../../lib/programClient";
import { useAuctionSchedule } from "../../lib/useAuctionSchedule";
import { BorshAccountsCoder } from "@coral-xyz/anchor";

const IS_DEVNET = !RPC_URL.includes("mainnet");

function formatCountdown(endTimeSecs) {
  const now = Math.floor(Date.now() / 1000);
  const secs = Math.max(0, endTimeSecs - now);
  if (secs === 0) return "Ended";
  const h = Math.floor(secs / 3600).toString().padStart(2, "0");
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function shortAddr(addr) {
  return addr ? addr.slice(0, 4) + "…" + addr.slice(-4) : "—";
}

function solStr(lamports) {
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(3) + " SOL";
}

async function fetchBidHistory(connection, auctionPubkey, auctionId) {
  const [bidVaultPubkey] = bidVaultPDA(auctionId);
  const sigs = await connection.getSignaturesForAddress(auctionPubkey, { limit: 20 });
  if (!sigs.length) return [];

  const results = await Promise.all(
    sigs.slice(0, 15).map(({ signature, blockTime }) =>
      connection
        .getTransaction(signature, { maxSupportedTransactionVersion: 0 })
        .then((tx) => ({ signature, blockTime, tx }))
        .catch(() => null)
    )
  );

  const bids = [];
  for (const item of results) {
    if (!item?.tx) continue;
    const { signature, blockTime, tx } = item;
    const meta = tx.meta;
    const msg = tx.transaction.message;
    const accountKeys =
      "staticAccountKeys" in msg ? msg.staticAccountKeys : msg.accountKeys;
    if (!accountKeys) continue;
    const vaultIdx = accountKeys.findIndex(
      (k) => k.toBase58() === bidVaultPubkey.toBase58()
    );
    if (vaultIdx === -1) continue;
    const postBalance = meta.postBalances[vaultIdx];
    if (postBalance === 0) continue;
    const bidder = accountKeys[0].toBase58();
    bids.push({ bidder, lamports: postBalance, blockTime, signature });
  }
  return bids.reverse();
}

/** Fetch all unsettled AuctionState accounts from the program. */
async function fetchActiveAuctions(connection) {
  const AUCTION_STATE_SIZE = 150;
  const coder = new BorshAccountsCoder(idl);
  const accounts = await connection.getProgramAccounts(new PublicKey(PROGRAM_ID), {
    filters: [{ dataSize: AUCTION_STATE_SIZE }],
  });
  const active = [];
  for (const { pubkey, account } of accounts) {
    try {
      const state = coder.decode("AuctionState", account.data);
      if (!state.settled) {
        active.push({ pubkey, state });
      }
    } catch {}
  }
  return active;
}

// ── Single auction panel ──────────────────────────────────────────────────────

function AuctionPanel({ auctionData, slotMeta, connection, wallet }) {
  const { pubkey, state } = auctionData;
  const cluster = IS_DEVNET ? "?cluster=devnet" : "";

  const [countdown, setCountdown] = useState("--:--:--");
  const [bidInput, setBidInput] = useState("");
  const [bidding, setBidding] = useState(false);
  const [txError, setTxError] = useState(null);
  const [txSuccess, setTxSuccess] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const countdownRef = useRef(null);

  // Countdown ticker
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    const tick = () => setCountdown(formatCountdown(state.end_time.toNumber()));
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [state.end_time]);

  // Pre-fill min bid
  useEffect(() => {
    const minLamports = computeMinNextBid(state).toNumber();
    const minSol = Math.ceil(minLamports / (LAMPORTS_PER_SOL / 1000)) / 1000;
    setBidInput(minSol.toFixed(3));
  }, [state]);

  // Fetch bid history
  useEffect(() => {
    setHistoryLoading(true);
    fetchBidHistory(connection, pubkey, state.auction_id)
      .then(setBidHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [pubkey.toBase58()]); // eslint-disable-line react-hooks/exhaustive-deps

  async function placeBid() {
    if (!wallet.publicKey) return;
    setTxError(null);
    setTxSuccess(null);
    setBidding(true);
    try {
      const bidLamports = new BN(Math.round(parseFloat(bidInput) * LAMPORTS_PER_SOL));
      const minBid = computeMinNextBid(state);
      if (bidLamports.lt(minBid)) {
        setTxError(`Bid too low. Minimum: ${(minBid.toNumber() / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
        return;
      }
      const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program = new Program(idl, provider);
      const auctionId = state.auction_id;
      const [bidVault] = bidVaultPDA(auctionId);
      const [config] = configPDA();
      const prevBidder = state.current_bidder ?? wallet.publicKey;

      const sig = await program.methods
        .placeBid(bidLamports)
        .accounts({ bidder: wallet.publicKey, config, auction: pubkey, bidVault, prevBidder, systemProgram: SystemProgram.programId })
        .rpc();

      setTxSuccess(sig);
      setHistoryLoading(true);
      fetchBidHistory(connection, pubkey, auctionId)
        .then(setBidHistory)
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    } catch (e) {
      setTxError(
        e?.message?.match(/custom program error: (0x\w+)/)?.[0] || e?.message || "Transaction failed"
      );
    } finally {
      setBidding(false);
    }
  }

  const auctionEnded = countdown === "Ended";
  const auctionActive = !auctionEnded;
  const currentBidSol = state.current_bid.isZero()
    ? null
    : (state.current_bid.toNumber() / LAMPORTS_PER_SOL).toFixed(3);
  const minBidSol = (Math.ceil(computeMinNextBid(state).toNumber() / (LAMPORTS_PER_SOL / 1000)) / 1000).toFixed(3);

  return (
    <div className="bg-card border border-border grid md:grid-cols-[240px_1fr] overflow-hidden">
      {/* NFT image */}
      <div className="aspect-square md:aspect-auto bg-border/20 relative">
        {slotMeta?.image ? (
          <img src={slotMeta.image} alt={slotMeta?.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-blackletter text-5xl text-muted/20">?</span>
          </div>
        )}
      </div>

      {/* Details panel */}
      <div className="p-5 md:p-6 flex flex-col gap-5">
        {/* Name + seller */}
        <div>
          <h3 className="font-blackletter text-2xl text-gold leading-tight">
            {slotMeta?.name || "Commoner"}
          </h3>
          {slotMeta?.traits?.length > 0 && (
            <p className="text-sm text-muted mt-1">{slotMeta.traits.join(" · ")}</p>
          )}
          {slotMeta?.seller && (
            <p className="text-xs text-muted mt-1">
              Listed by{" "}
              <a href={`https://solscan.io/account/${slotMeta.seller}${cluster}`} target="_blank" rel="noreferrer" className="font-mono hover:text-foreground transition-colors">
                {shortAddr(slotMeta.seller)}
              </a>
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-border pt-4">
          <div>
            <p className="text-xs text-muted mb-1 tracking-widest uppercase">Reserve</p>
            <p className="text-lg font-semibold">
              {slotMeta?.reservePrice != null ? solStr(slotMeta.reservePrice) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted mb-1 tracking-widest uppercase">Current Bid</p>
            <p className="text-lg font-semibold text-gold">
              {currentBidSol ? `${currentBidSol} SOL` : "No bids"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted mb-1 tracking-widest uppercase">Min Next Bid</p>
            <p className="text-lg font-semibold">{minBidSol} SOL</p>
          </div>
          <div>
            <p className="text-xs text-muted mb-1 tracking-widest uppercase">Time Left</p>
            <p className={`text-lg font-semibold font-mono ${auctionEnded ? "text-muted" : ""}`}>
              {countdown}
            </p>
          </div>
        </div>

        {/* Bid form */}
        <div className="border-t border-border pt-4">
          {auctionActive ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="number"
                    step="0.001"
                    min={minBidSol}
                    value={bidInput}
                    onChange={(e) => setBidInput(e.target.value)}
                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
                    placeholder={minBidSol}
                    disabled={!wallet.publicKey || bidding}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">SOL</span>
                </div>
                {wallet.publicKey ? (
                  <button onClick={placeBid} disabled={bidding} className="px-5 py-2 bg-gold text-card text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                    {bidding ? "Sending…" : "Place Bid"}
                  </button>
                ) : (
                  <WalletMultiButton style={{ backgroundColor: "#1a1a1a", color: "#f5f5f5", fontSize: "0.875rem", fontWeight: 600, borderRadius: 0, height: "auto", padding: "0.5rem 1rem", lineHeight: 1.5 }} />
                )}
              </div>
              {txError && <p className="text-xs text-red-600">{txError}</p>}
              {txSuccess && (
                <p className="text-xs text-green-700">
                  Bid placed!{" "}
                  <a href={`https://explorer.solana.com/tx/${txSuccess}${IS_DEVNET ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer" className="underline">
                    View tx ↗
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Auction ended — awaiting settlement.</p>
          )}
        </div>

        {/* Bid history */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted tracking-widest uppercase">
              Bid History
              {bidHistory.length > 0 && (
                <span className="ml-2 font-normal normal-case tracking-normal">({bidHistory.length} bid{bidHistory.length !== 1 ? "s" : ""})</span>
              )}
            </p>
            <a href={`https://solscan.io/account/${pubkey.toBase58()}${cluster}`} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-foreground transition-colors">
              View on Solscan ↗
            </a>
          </div>
          {historyLoading ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : bidHistory.length === 0 ? (
            <p className="text-xs text-muted">No bids yet.</p>
          ) : (
            <div className="space-y-2">
              {bidHistory.map((bid, i) => (
                <div key={i} className={`flex items-center justify-between text-xs py-1 ${i < bidHistory.length - 1 ? "border-b border-border/50" : ""}`}>
                  <a href={`https://solscan.io/account/${bid.bidder}${cluster}`} target="_blank" rel="noreferrer" className="font-mono text-muted hover:text-foreground transition-colors">
                    {shortAddr(bid.bidder)}
                  </a>
                  <span className="font-semibold text-gold">{solStr(bid.lamports)}</span>
                  <a href={`https://solscan.io/tx/${bid.signature}${cluster}`} target="_blank" rel="noreferrer" className="text-muted hover:text-foreground transition-colors tabular-nums">
                    {bid.blockTime ? new Date(bid.blockTime * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} ↗
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Parent: fetches all active auctions and maps metadata ─────────────────────

export default function CurrentAuction() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { slots, loading: scheduleLoading } = useAuctionSchedule();

  const [activeAuctions, setActiveAuctions] = useState([]); // [{pubkey, state}]
  const [loadingChain, setLoadingChain] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const auctions = await fetchActiveAuctions(connection);
      setActiveAuctions(auctions);
    } catch {
      setActiveAuctions([]);
    } finally {
      setLoadingChain(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Build a mint → slotMeta lookup from the schedule hook
  const mintToSlot = {};
  for (const s of slots) {
    mintToSlot[s.nftMint] = s;
  }

  // If no on-chain auctions exist yet, show today's scheduled slot as a placeholder
  const today = new Date().toISOString().split("T")[0];
  const todaySlot = slots.find((s) => s.dateStr === today);

  if (scheduleLoading || loadingChain) return null;

  // Only show auctions active now OR ended within the last 4 hours.
  // This prevents old unsettled auctions from cluttering the homepage.
  const STALE_CUTOFF_SECS = 4 * 60 * 60;
  const nowSecs = Math.floor(Date.now() / 1000);
  const recentAuctions = activeAuctions.filter((a) => {
    const endTime = a.state.end_time.toNumber();
    return endTime > nowSecs - STALE_CUTOFF_SECS;
  });

  // Sort: most recently started first (highest auctionId = most recent midnight)
  const sorted = [...recentAuctions].sort(
    (a, b) => b.state.auction_id.toString() - a.state.auction_id.toString()
  );
  const hasActiveOnChain = sorted.length > 0;

  return (
    <section id="current-auction">
      <h2 className="font-blackletter text-2xl text-gold mb-6">
        Today&apos;s Auction
      </h2>

      {hasActiveOnChain ? (
        <div className="space-y-8">
          {sorted.map((auctionData) => {
            const mintStr = auctionData.state.nft_mint?.toBase58?.() ?? "";
            const slotMeta = mintToSlot[mintStr] || null;
            return (
              <AuctionPanel
                key={auctionData.pubkey.toBase58()}
                auctionData={auctionData}
                slotMeta={slotMeta}
                connection={connection}
                wallet={wallet}
              />
            );
          })}
        </div>
      ) : todaySlot ? (
        /* Placeholder when auction hasn't been initialized on-chain yet */
        <div className="bg-card border border-border grid md:grid-cols-[240px_1fr] overflow-hidden">
          <div className="aspect-square md:aspect-auto bg-border/20 relative">
            {todaySlot.image ? (
              <img src={todaySlot.image} alt={todaySlot.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-blackletter text-5xl text-muted/20">?</span>
              </div>
            )}
          </div>
          <div className="p-5 md:p-6 flex flex-col gap-4">
            <div>
              <h3 className="font-blackletter text-2xl text-gold leading-tight">{todaySlot.name}</h3>
              {todaySlot.traits?.length > 0 && (
                <p className="text-sm text-muted mt-1">{todaySlot.traits.join(" · ")}</p>
              )}
            </div>
            <p className="text-sm text-muted">Bidding opens shortly — check back soon.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
