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
  findAuctionByMint,
  computeMinNextBid,
  PROGRAM_ID,
  RPC_URL,
} from "../../lib/programClient";
import { useAuctionSchedule } from "../../lib/useAuctionSchedule";

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

    // Handle both legacy and v0 account keys
    const accountKeys =
      "staticAccountKeys" in msg ? msg.staticAccountKeys : msg.accountKeys;
    if (!accountKeys) continue;

    const vaultIdx = accountKeys.findIndex(
      (k) => k.toBase58() === bidVaultPubkey.toBase58()
    );
    if (vaultIdx === -1) continue; // create_auction has no bid vault

    const postBalance = meta.postBalances[vaultIdx];
    if (postBalance === 0) continue; // settlement drains vault

    // Fee payer (accountKeys[0]) = bidder
    const bidder = accountKeys[0].toBase58();
    bids.push({ bidder, lamports: postBalance, blockTime, signature });
  }

  return bids.reverse(); // oldest → newest
}

export default function CurrentAuction() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { slots, loading: scheduleLoading } = useAuctionSchedule();

  const [todaySlot, setTodaySlot] = useState(null);
  const [chainAuction, setChainAuction] = useState(null);
  const [countdown, setCountdown] = useState("--:--:--");
  const [bidInput, setBidInput] = useState("");
  const [bidding, setBidding] = useState(false);
  const [txError, setTxError] = useState(null);
  const [txSuccess, setTxSuccess] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const countdownRef = useRef(null);
  const cluster = IS_DEVNET ? "?cluster=devnet" : "";

  // Find today's slot
  useEffect(() => {
    if (scheduleLoading) return;
    const today = new Date().toISOString().split("T")[0];
    setTodaySlot(slots.find((s) => s.dateStr === today) || null);
  }, [slots, scheduleLoading]);

  // Fetch on-chain auction state
  const fetchChainState = useCallback(async () => {
    if (!todaySlot?.nftMint) return;
    try {
      const result = await findAuctionByMint(
        connection,
        new PublicKey(todaySlot.nftMint)
      );
      setChainAuction(result);
    } catch {}
  }, [todaySlot, connection]);

  useEffect(() => {
    fetchChainState();
    const id = setInterval(fetchChainState, 15_000);
    return () => clearInterval(id);
  }, [fetchChainState]);

  // Countdown ticker
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!chainAuction) { setCountdown("--:--:--"); return; }
    const tick = () =>
      setCountdown(formatCountdown(chainAuction.state.end_time.toNumber()));
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [chainAuction]);

  // Pre-fill min bid
  useEffect(() => {
    if (!chainAuction) return;
    setBidInput(
      (computeMinNextBid(chainAuction.state).toNumber() / LAMPORTS_PER_SOL).toFixed(3)
    );
  }, [chainAuction]);

  // Fetch bid history whenever auction account changes
  const auctionPubkeyStr = chainAuction?.pubkey.toBase58();
  useEffect(() => {
    if (!chainAuction) { setBidHistory([]); return; }
    setHistoryLoading(true);
    fetchBidHistory(connection, chainAuction.pubkey, chainAuction.state.auction_id)
      .then(setBidHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [auctionPubkeyStr]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
      const program = new Program(idl, provider);
      const auctionId = chainAuction.state.auction_id;
      const [bidVault] = bidVaultPDA(auctionId);
      const [config] = configPDA();
      const prevBidder = chainAuction.state.current_bidder ?? wallet.publicKey;

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
      // Refresh bid history
      setHistoryLoading(true);
      fetchBidHistory(connection, chainAuction.pubkey, auctionId)
        .then(setBidHistory)
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    } catch (e) {
      setTxError(
        e?.message?.match(/custom program error: (0x\w+)/)?.[0] ||
        e?.message ||
        "Transaction failed"
      );
    } finally {
      setBidding(false);
    }
  }

  if (scheduleLoading || !todaySlot) return null;

  const auctionActive =
    chainAuction && !chainAuction.state.settled && countdown !== "Ended";
  const currentBidSol = chainAuction
    ? chainAuction.state.current_bid.isZero()
      ? null
      : (chainAuction.state.current_bid.toNumber() / LAMPORTS_PER_SOL).toFixed(3)
    : null;
  const minBidSol = chainAuction
    ? (computeMinNextBid(chainAuction.state).toNumber() / LAMPORTS_PER_SOL).toFixed(3)
    : null;

  return (
    <section>
      <h2 className="font-blackletter text-2xl text-gold mb-6">
        Today&apos;s Auction
      </h2>

      <div className="bg-card border border-border grid md:grid-cols-[240px_1fr] overflow-hidden">
        {/* NFT image */}
        <div className="aspect-square md:aspect-auto bg-border/20 relative">
          {todaySlot.image ? (
            <img
              src={todaySlot.image}
              alt={todaySlot.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
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
              {todaySlot.name}
            </h3>
            {todaySlot.traits?.length > 0 && (
              <p className="text-sm text-muted mt-1">
                {todaySlot.traits.join(" · ")}
              </p>
            )}
            {todaySlot.seller && (
              <p className="text-xs text-muted mt-1">
                Listed by{" "}
                <a
                  href={`https://solscan.io/account/${todaySlot.seller}${cluster}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono hover:text-foreground transition-colors"
                >
                  {shortAddr(todaySlot.seller)}
                </a>
              </p>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-border pt-4">
            <div>
              <p className="text-xs text-muted mb-1 tracking-widest uppercase">Reserve</p>
              <p className="text-lg font-semibold">
                {todaySlot.reservePrice != null
                  ? solStr(todaySlot.reservePrice)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1 tracking-widest uppercase">Current Bid</p>
              <p className="text-lg font-semibold text-gold">
                {currentBidSol ? `${currentBidSol} SOL` : chainAuction ? "No bids" : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1 tracking-widest uppercase">Min Next Bid</p>
              <p className="text-lg font-semibold">
                {minBidSol ? `${minBidSol} SOL` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1 tracking-widest uppercase">Time Left</p>
              <p className="text-lg font-semibold font-mono">
                {chainAuction ? countdown : "—"}
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
                      className="px-5 py-2 bg-gold text-card text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
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
                {txError && <p className="text-xs text-red-600">{txError}</p>}
                {txSuccess && (
                  <p className="text-xs text-green-700">
                    Bid placed!{" "}
                    <a
                      href={`https://explorer.solana.com/tx/${txSuccess}${IS_DEVNET ? "?cluster=devnet" : ""}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      View tx ↗
                    </a>
                  </p>
                )}
              </div>
            ) : chainAuction?.state.settled ? (
              <p className="text-sm text-muted">This auction has been settled.</p>
            ) : chainAuction ? (
              <p className="text-sm text-muted">Auction ended — awaiting settlement.</p>
            ) : (
              <p className="text-sm text-muted">
                {wallet.publicKey
                  ? "Bidding opens once the auction is initialized."
                  : "Connect your wallet to place a bid when the auction opens."}
              </p>
            )}
          </div>

          {/* Bid history */}
          {chainAuction && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted tracking-widest uppercase">
                  Bid History
                  {bidHistory.length > 0 && (
                    <span className="ml-2 font-normal normal-case tracking-normal">
                      ({bidHistory.length} bid{bidHistory.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </p>
                <a
                  href={`https://solscan.io/account/${chainAuction.pubkey.toBase58()}${cluster}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
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
                    <div
                      key={i}
                      className={`flex items-center justify-between text-xs py-1 ${
                        i < bidHistory.length - 1
                          ? "border-b border-border/50"
                          : ""
                      }`}
                    >
                      <a
                        href={`https://solscan.io/account/${bid.bidder}${cluster}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-muted hover:text-foreground transition-colors"
                      >
                        {shortAddr(bid.bidder)}
                      </a>
                      <span className="font-semibold text-gold">
                        {solStr(bid.lamports)}
                      </span>
                      <a
                        href={`https://solscan.io/tx/${bid.signature}${cluster}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted hover:text-foreground transition-colors tabular-nums"
                      >
                        {bid.blockTime
                          ? new Date(bid.blockTime * 1000).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}{" "}
                        ↗
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
