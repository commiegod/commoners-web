"use client";

import { useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useAuctionSchedule } from "../../lib/useAuctionSchedule";
import { RPC_URL } from "../../lib/programClient";
import ListSlotModal from "./ListSlotModal";

const IS_DEVNET = !RPC_URL.includes("mainnet");

function shortAddr(addr) {
  return addr ? addr.slice(0, 4) + "…" + addr.slice(-4) : "—";
}

function collectionName(name) {
  const match = name?.match(/^([\w\s]+?)\s*#/);
  return match ? match[1].trim() : null;
}

export default function RecentAuctions() {
  const { slots, loading, invalidate } = useAuctionSchedule();
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = slots.filter((s) => s.dateStr >= today).slice(0, 10);

  if (!loading && upcoming.length === 0) return null;

  const cluster = IS_DEVNET ? "?cluster=devnet" : "";

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-blackletter text-2xl text-gold">Auction Schedule</h2>
        <button
          onClick={() => setShowModal(true)}
          className="text-sm text-muted hover:text-foreground border border-border px-3 py-1 transition-colors"
        >
          List your NFT
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-40 bg-card border border-border overflow-hidden animate-pulse"
              >
                <div className="w-full aspect-square bg-border/30" />
                <div className="p-2 space-y-1">
                  <div className="h-3 bg-border rounded w-3/4" />
                  <div className="h-3 bg-border rounded w-1/2" />
                </div>
              </div>
            ))
          : upcoming.map((slot) => (
              <button
                key={slot.dateStr}
                onClick={() => setSelected(slot)}
                className="flex-shrink-0 w-40 bg-card border border-border overflow-hidden text-left hover:border-gold transition-colors focus:outline-none"
              >
                {slot.image ? (
                  <img
                    src={slot.image}
                    alt={slot.name}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-border/30 flex items-center justify-center">
                    <span className="font-blackletter text-2xl text-muted/30">?</span>
                  </div>
                )}
                <div className="p-2">
                  <p className="text-sm font-medium truncate">{slot.name}</p>
                  <p className="text-xs text-muted">{slot.dateStr}</p>
                </div>
              </button>
            ))}
      </div>

      {/* ── Slot detail modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative bg-background border border-border w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 z-10 text-muted hover:text-foreground bg-black/60 w-7 h-7 flex items-center justify-center text-sm"
            >
              ✕
            </button>

            {selected.image ? (
              <img
                src={selected.image}
                alt={selected.name}
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square bg-border/30 flex items-center justify-center">
                <span className="font-blackletter text-4xl text-muted/20">?</span>
              </div>
            )}

            <div className="p-4">
              <h2 className="font-blackletter text-2xl text-gold mb-0.5">
                {selected.name}
              </h2>
              {collectionName(selected.name) && (
                <p className="text-xs text-muted mb-3">
                  {collectionName(selected.name)}
                </p>
              )}

              {/* Traits */}
              {selected.traits?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selected.traits.map((t, i) => (
                    <span
                      key={i}
                      className="bg-card border border-border px-3 py-1 text-sm"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Auction details */}
              <div className="border-t border-border pt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Auction Date</span>
                  <span>
                    {new Date(selected.dateStr + "T12:00:00Z").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Reserve Price</span>
                  <span>
                    {selected.reservePrice != null
                      ? (selected.reservePrice / LAMPORTS_PER_SOL).toFixed(3) + " SOL"
                      : "—"}
                  </span>
                </div>
                {selected.seller && (
                  <div className="flex justify-between">
                    <span className="text-muted">Seller</span>
                    <a
                      href={`https://solscan.io/account/${selected.seller}${cluster}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-foreground hover:text-gold transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {shortAddr(selected.seller)} ↗
                    </a>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">Mint</span>
                  <a
                    href={`https://solscan.io/token/${selected.nftMint}${cluster}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-foreground hover:text-gold transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {shortAddr(selected.nftMint)} ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ListSlotModal
          takenDates={slots.map((s) => s.dateStr)}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            invalidate();
          }}
        />
      )}
    </section>
  );
}
