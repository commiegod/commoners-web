"use client";

import { useState } from "react";
import { useAuctionSchedule } from "../../lib/useAuctionSchedule";
import ListSlotModal from "./ListSlotModal";

export default function RecentAuctions() {
  const { slots, loading, invalidate } = useAuctionSchedule();
  const [showModal, setShowModal] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = slots.filter((s) => s.dateStr >= today).slice(0, 10);

  if (!loading && upcoming.length === 0) return null;

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
          : upcoming.map(({ dateStr, name }) => (
              <div
                key={dateStr}
                className="flex-shrink-0 w-40 bg-card border border-border overflow-hidden"
              >
                {/* Placeholder — artwork revealed on auction day */}
                <div className="w-full aspect-square bg-border/30 flex items-center justify-center">
                  <span className="font-blackletter text-2xl text-muted/30">?</span>
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium truncate text-muted">{name}</p>
                  <p className="text-xs text-muted">{dateStr}</p>
                </div>
              </div>
            ))}
      </div>

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
