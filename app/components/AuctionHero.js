"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import bounties from "../../data/bounties.json";
import idl from "../../lib/idl.json";
import {
  PROGRAM_ID,
  configPDA,
  bidVaultPDA,
  findAuctionByMint,
  computeMinNextBid,
} from "../../lib/programClient";
import { useAuctionSchedule } from "../../lib/useAuctionSchedule";

function formatCountdown(endTimeSecs) {
  const now = Math.floor(Date.now() / 1000);
  const secs = Math.max(0, endTimeSecs - now);
  if (secs === 0) return "Ended";
  const h = Math.floor(secs / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((secs % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function lamportsToSol(lamports) {
  return (lamports.toNumber() / LAMPORTS_PER_SOL).toFixed(3);
}

// ── skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-0 animate-pulse">
      <div className="bg-card aspect-square" />
      <div className="bg-card md:border-l border-t md:border-t-0 border-border p-5 md:p-8 flex flex-col gap-4">
        <div className="h-8 w-48 bg-border rounded" />
        <div className="h-4 w-32 bg-border rounded" />
        <div className="mt-auto space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-12 bg-border rounded" />
            <div className="h-12 bg-border rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function AuctionHero() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { slots, loading: scheduleLoading } = useAuctionSchedule();

  const [auctionData, setAuctionData] = useState(null);
  const [label, setLabel] = useState("TODAY'S AUCTION");
  const [chainAuction, setChainAuction] = useState(null); // { pubkey, state }
  const [countdown, setCountdown] = useState("--:--:--");
  const [bidInput, setBidInput] = useState("");
  const [bidding, setBidding] = useState(false);
  const [txError, setTxError] = useState(null);
  const [txSuccess, setTxSuccess] = useState(null);
  const [mounted, setMounted] = useState(false);

  const countdownRef = useRef(null);

  // Derive today's or next upcoming auction from live slot data
  useEffect(() => {
    if (scheduleLoading) return;
    const today = new Date().toISOString().split("T")[0];
    const todaySlot = slots.find((s) => s.dateStr === today);
    if (todaySlot) {
      setAuctionData({
        ...todaySlot,
        date: todaySlot.dateStr,
        bounty: bounties[todaySlot.dateStr] || { human: [], ai: [] },
      });
      setLabel("TODAY'S AUCTION");
    } else {
      const next = slots.find((s) => s.dateStr >= today);
      if (next) {
        setAuctionData({
          ...next,
          date: next.dateStr,
          bounty: bounties[next.dateStr] || { human: [], ai: [] },
        });
        setLabel(`UPCOMING · ${next.dateStr}`);
      }
    }
    setMounted(true);
  }, [slots, scheduleLoading]);

  // Fetch live chain state for the current NFT
  const fetchChainState = useCallback(async () => {
    if (!auctionData?.nftMint) return;
    try {
      const mint = new PublicKey(auctionData.nftMint);
      const result = await findAuctionByMint(connection, mint);
      setChainAuction(result);
    } catch (e) {
      // RPC errors are non-fatal — keep showing last known state
      console.warn("Chain fetch failed:", e.message);
    }
  }, [auctionData, connection]);

  useEffect(() => {
    fetchChainState();
    const interval = setInterval(fetchChainState, 15_000);
    return () => clearInterval(interval);
  }, [fetchChainState]);

  // Live countdown ticker
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!chainAuction) {
      setCountdown("--:--:--");
      return;
    }
    const tick = () =>
      setCountdown(formatCountdown(chainAuction.state.end_time.toNumber()));
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [chainAuction]);

  // Pre-fill min bid when chain state loads
  useEffect(() => {
    if (!chainAuction) return;
    const min = computeMinNextBid(chainAuction.state);
    setBidInput((min.toNumber() / LAMPORTS_PER_SOL).toFixed(3));
  }, [chainAuction]);

  // ── bid placement ───────────────────────────────────────────────────────────

  async function placeBid() {
    if (!wallet.publicKey || !chainAuction) return;
    setTxError(null);
    setTxSuccess(null);
    setBidding(true);
    try {
      const bidLamports = new BN(
        Math.round(parseFloat(bidInput) * LAMPORTS_PER_SOL)
      );
      const minBid = computeMinNextBid(chainAuction.state);
      if (bidLamports.lt(minBid)) {
        setTxError(
          `Bid too low. Minimum: ${(minBid.toNumber() / LAMPORTS_PER_SOL).toFixed(3)} SOL`
        );
        return;
      }

      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });
      const program = new Program(idl, provider);

      const auctionId = chainAuction.state.auction_id;
      const [bidVault] = bidVaultPDA(auctionId);
      const [config] = configPDA();
      const prevBidder =
        chainAuction.state.current_bidder ?? wallet.publicKey;

      const sig = await program.methods
        .placeBid(bidLamports)
        .accounts({
          bidder: wallet.publicKey,
          config,
          auction: chainAuction.pubkey,
          bidVault,
          prevBidder,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxSuccess(sig);
      await fetchChainState();
    } catch (e) {
      const msg =
        e?.message?.match(/custom program error: (0x\w+)/)?.[0] ||
        e?.message ||
        "Transaction failed";
      setTxError(msg);
    } finally {
      setBidding(false);
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────

  if (!mounted) return <Skeleton />;

  if (!auctionData) {
    return (
      <div className="bg-card border border-border p-12 text-center text-muted">
        No auctions scheduled.
      </div>
    );
  }

  const auctionActive =
    chainAuction && !chainAuction.state.settled && countdown !== "Ended";
  const currentBidSol = chainAuction
    ? lamportsToSol(chainAuction.state.current_bid)
    : null;
  const minBidSol = chainAuction
    ? (computeMinNextBid(chainAuction.state).toNumber() / LAMPORTS_PER_SOL).toFixed(3)
    : null;

  const allBounties = [
    ...(auctionData.bounty.human || []).map((h) => ({ ...h, type: "Human" })),
    ...(auctionData.bounty.ai || []).map((a) => ({ ...a, type: "AI" })),
  ];

  return (
    <section>
      {/* Nouns-style two-column hero */}
      <div className="grid md:grid-cols-2 gap-0">
        {/* Left: Large NFT image */}
        <div className="bg-card">
          <img
            src={auctionData.image}
            alt={auctionData.name}
            className="w-full aspect-square object-cover"
          />
        </div>

        {/* Right: Auction info */}
        <div className="bg-card md:border-l border-t md:border-t-0 border-border p-5 md:p-8 flex flex-col justify-between gap-6">
          <div>
            <p className="text-xs text-muted tracking-widest mb-2">{label}</p>
            <h1 className="font-blackletter text-2xl md:text-4xl text-gold mb-2">
              {auctionData.name}
            </h1>
            <p className="text-muted">{auctionData.traits.join(" · ")}</p>

            {auctionData.seller && (
              <p className="text-xs text-muted mt-3">
                Listed by {auctionData.seller.slice(0, 4)}...
                {auctionData.seller.slice(-4)}
              </p>
            )}
          </div>

          {/* Live Bid Info */}
          <div>
            {chainAuction ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted mb-1">Current Bid</p>
                    <p className="text-2xl font-semibold text-gold">
                      {chainAuction.state.current_bid.isZero()
                        ? "No bids"
                        : `${currentBidSol} SOL`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Time Left</p>
                    <p className="text-2xl font-semibold">{countdown}</p>
                  </div>
                </div>

                {auctionActive ? (
                  <div className="space-y-3">
                    {minBidSol && (
                      <p className="text-xs text-muted">
                        Minimum bid: {minBidSol} SOL
                      </p>
                    )}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.001"
                          min={minBidSol || "0"}
                          value={bidInput}
                          onChange={(e) => setBidInput(e.target.value)}
                          className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
                          placeholder={minBidSol || "0.000"}
                          disabled={!wallet.publicKey || bidding}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                          SOL
                        </span>
                      </div>
                      {wallet.publicKey ? (
                        <button
                          onClick={placeBid}
                          disabled={bidding}
                          className="px-4 py-2 bg-gold text-card text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {bidding ? "Sending…" : "Place Bid"}
                        </button>
                      ) : (
                        <WalletMultiButton
                          style={{
                            backgroundColor: "#1a1a1a",
                            color: "#f5f5f5",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            borderRadius: 0,
                            height: "auto",
                            padding: "0.5rem 1rem",
                            lineHeight: 1.5,
                          }}
                        />
                      )}
                    </div>

                    {txError && (
                      <p className="text-xs text-red-600">{txError}</p>
                    )}
                    {txSuccess && (
                      <p className="text-xs text-green-700 break-all">
                        Bid placed!{" "}
                        <a
                          href={`https://explorer.solana.com/tx/${txSuccess}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          View tx
                        </a>
                      </p>
                    )}
                  </div>
                ) : chainAuction.state.settled ? (
                  <p className="text-xs text-muted">
                    This auction has been settled.
                  </p>
                ) : (
                  <p className="text-xs text-muted">
                    Auction has ended — awaiting settlement.
                  </p>
                )}
              </>
            ) : (
              /* No on-chain auction yet — show schedule fallback */
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted mb-1">Auction Date</p>
                    <p className="text-2xl font-semibold">
                      {new Date(
                        auctionData.date + "T12:00:00Z"
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Opens</p>
                    <p className="text-2xl font-semibold">Midnight UTC</p>
                  </div>
                </div>
                <p className="text-xs text-muted">
                  Auction opens at midnight UTC on auction day. Come back then
                  to place your bid.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bounty Art Section */}
      {allBounties.length > 0 && (
        <div className="mt-12">
          <h2 className="font-blackletter text-2xl text-gold mb-6">
            Artist Bounty
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {allBounties.map((b, i) => (
              <div
                key={i}
                className="bg-card border border-border overflow-hidden"
              >
                <img
                  src={b.image}
                  alt={b.artist || b.model || "Bounty art"}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-3">
                  <p className="text-sm font-medium">{b.artist || b.model}</p>
                  <p className="text-xs text-muted">{b.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
