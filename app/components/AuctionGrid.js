"use client";

// AuctionGrid — multi-auction summary grid + empty state for the homepage.
//
// Behavior:
//   * Fetches all unsettled AuctionState accounts via fetchActiveAuctions.
//   * Renders a grid of compact summary cards (image, name, bid, countdown).
//   * Selecting a card mounts the existing AuctionPanel for that specific
//     auction below the grid — no duplicated bid/settle logic.
//   * When zero live auctions, renders the "the square is quiet" empty state
//     with a CTA to list a MidEvil. This is the path the homepage takes
//     when nothing is happening, instead of looking broken.
//
// Filtering rule mirrors CurrentAuction: keep auctions that are still running
// OR ended within the last 4 hours (so winners can settle from the homepage).

import { useEffect, useMemo, useState, useCallback } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { usePhantomDeeplink } from "../context/PhantomDeeplinkContext";
import { fetchActiveAuctions } from "../../lib/programClient";
import { useAuctionSchedule } from "../../lib/useAuctionSchedule";
import { AuctionPanel } from "./CurrentAuction";

const STALE_CUTOFF_SECS = 4 * 60 * 60;
const REFRESH_MS = 30_000;

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

// Live countdown that re-renders every second without parent state churn.
function Countdown({ endTime }) {
  const [text, setText] = useState(() => formatCountdown(endTime));
  useEffect(() => {
    const id = setInterval(() => setText(formatCountdown(endTime)), 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return <span className="font-mono">{text}</span>;
}

function AuctionCard({ auction, slotMeta, isSelected, onSelect }) {
  const { state } = auction;
  const ended = state.end_time.toNumber() <= Math.floor(Date.now() / 1000);
  const currentBid = state.current_bid.isZero()
    ? null
    : (state.current_bid.toNumber() / LAMPORTS_PER_SOL).toFixed(3);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group text-left bg-card border overflow-hidden transition-colors ${
        isSelected
          ? "border-foreground"
          : "border-border hover:border-foreground/60"
      }`}
    >
      <div className="aspect-square bg-border/30 relative overflow-hidden">
        {slotMeta?.image ? (
          <img
            src={slotMeta.image}
            alt={slotMeta.name || "MidEvil"}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-blackletter text-5xl text-muted/20">?</span>
          </div>
        )}
        {!ended && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-1 bg-black/70 text-white text-[10px] font-blackletter tracking-widest rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#b34a2a]" />
            LIVE
          </span>
        )}
        {ended && (
          <span className="absolute top-2.5 left-2.5 inline-block px-2 py-1 bg-black/70 text-white text-[10px] font-blackletter tracking-widest rounded-full">
            ENDED
          </span>
        )}
      </div>
      <div className="px-3.5 pt-3 pb-3.5">
        <h3 className="font-blackletter text-base text-foreground leading-tight truncate">
          {slotMeta?.name || `Auction #${state.auction_id?.toString?.() ?? ""}`}
        </h3>
        {slotMeta?.seller && (
          <p className="text-[11px] text-muted mt-0.5 font-mono">
            {shortAddr(slotMeta.seller)}
          </p>
        )}
        <div className="flex items-end justify-between mt-3 pt-2 border-t border-border/60">
          <div>
            <p className="text-[10px] text-muted tracking-widest">CURRENT BID</p>
            <p className="text-sm font-medium text-foreground">
              {currentBid ? `${currentBid} SOL` : "No bids"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted tracking-widest">TIME LEFT</p>
            <p className="text-sm font-medium text-foreground">
              <Countdown endTime={state.end_time.toNumber()} />
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="border border-border bg-card text-center py-14 px-6 max-w-2xl mx-auto">
      <div className="mb-5 flex justify-center">
        <svg
          width="56"
          height="56"
          viewBox="0 0 80 80"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
          className="text-foreground/55"
          aria-hidden="true"
        >
          <circle cx="40" cy="40" r="32" />
          <path d="M40 14 L40 28" strokeLinecap="round" />
          <path d="M40 52 L40 66" strokeLinecap="round" />
          <path d="M14 40 L28 40" strokeLinecap="round" />
          <path d="M52 40 L66 40" strokeLinecap="round" />
          <circle cx="40" cy="40" r="6" />
          <path d="M40 36 L40 40 L44 43" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="font-blackletter text-2xl md:text-3xl text-foreground mb-2 tracking-wide">
        The square is quiet
      </h3>
      <p className="text-muted text-sm leading-relaxed max-w-md mx-auto mb-6">
        No live auctions at the moment. The herald rests. Be the first to
        bring a MidEvil to the square — listing is open, and the next bidder
        is just a tweet away.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="#schedule"
          className="inline-block px-5 py-2.5 bg-foreground text-background text-sm font-blackletter tracking-wider rounded-full hover:opacity-85 transition-opacity"
        >
          List your MidEvil
        </a>
        <a
          href="#faq"
          className="inline-block px-5 py-2.5 border border-border text-muted text-sm font-blackletter tracking-wider rounded-full hover:text-foreground hover:border-foreground transition-colors"
        >
          How it works
        </a>
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card border border-border animate-pulse">
          <div className="aspect-square bg-border/30" />
          <div className="p-3.5 space-y-2">
            <div className="h-4 w-2/3 bg-border rounded" />
            <div className="h-3 w-1/3 bg-border rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AuctionGrid() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const deeplink = usePhantomDeeplink();
  const { slots, loading: scheduleLoading } = useAuctionSchedule();

  const [auctions, setAuctions] = useState([]);
  const [chainLoading, setChainLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const all = await fetchActiveAuctions(connection);
      setAuctions(all);
    } catch {
      setAuctions([]);
    } finally {
      setChainLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  // mint → slot metadata for image/name/seller
  const mintToSlot = useMemo(() => {
    const m = {};
    for (const s of slots) m[s.nftMint] = s;
    return m;
  }, [slots]);

  // Apply the same staleness filter as CurrentAuction so old unsettled
  // auctions don't loiter on the homepage.
  const visible = useMemo(() => {
    const cutoff = Math.floor(Date.now() / 1000) - STALE_CUTOFF_SECS;
    const filtered = auctions.filter((a) => a.state.end_time.toNumber() > cutoff);
    filtered.sort(
      (a, b) =>
        Number(b.state.auction_id.toString()) -
        Number(a.state.auction_id.toString())
    );
    return filtered;
  }, [auctions]);

  // Auto-select the most recent auction once data lands.
  useEffect(() => {
    if (!visible.length) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) => {
      const stillExists = prev && visible.some((a) => a.pubkey.toBase58() === prev);
      return stillExists ? prev : visible[0].pubkey.toBase58();
    });
  }, [visible]);

  const selected = useMemo(
    () => visible.find((a) => a.pubkey.toBase58() === selectedKey) || null,
    [visible, selectedKey]
  );

  if (scheduleLoading || chainLoading) {
    return (
      <section id="auctions">
        <header className="flex items-baseline justify-between mb-5">
          <h2 className="font-blackletter text-2xl md:text-3xl text-foreground tracking-wide">
            Live in the Square
          </h2>
        </header>
        <GridSkeleton />
      </section>
    );
  }

  if (visible.length === 0) {
    return (
      <section id="auctions">
        <header className="flex items-baseline justify-between mb-5">
          <h2 className="font-blackletter text-2xl md:text-3xl text-foreground tracking-wide">
            The Square Today
          </h2>
          <p className="text-[11px] text-muted tracking-widest font-blackletter">
            NO LIVE AUCTIONS
          </p>
        </header>
        <EmptyState />
      </section>
    );
  }

  return (
    <section id="auctions">
      <header className="flex items-baseline justify-between mb-5">
        <h2 className="font-blackletter text-2xl md:text-3xl text-foreground tracking-wide">
          Live in the Square
        </h2>
        <p className="text-[11px] text-muted tracking-widest font-blackletter">
          {visible.length} ACTIVE
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {visible.map((auction) => {
          const key = auction.pubkey.toBase58();
          const mintStr = auction.state.nft_mint?.toBase58?.() ?? "";
          const slotMeta = mintToSlot[mintStr] || null;
          return (
            <AuctionCard
              key={key}
              auction={auction}
              slotMeta={slotMeta}
              isSelected={key === selectedKey}
              onSelect={() => {
                setSelectedKey(key);
                if (typeof window !== "undefined") {
                  document
                    .getElementById("auction-detail")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            />
          );
        })}
      </div>

      {selected && (
        <div id="auction-detail" className="scroll-mt-20">
          <AuctionPanel
            auctionData={selected}
            slotMeta={
              mintToSlot[selected.state.nft_mint?.toBase58?.() ?? ""] || null
            }
            connection={connection}
            wallet={wallet}
            deeplink={deeplink}
          />
        </div>
      )}
    </section>
  );
}
