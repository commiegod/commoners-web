"use client";

import { useState, useEffect, useRef } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import bounties from "../../data/bounties.json";
import { RPC_URL } from "../../lib/programClient";
import { useAuctionSchedule } from "../../lib/useAuctionSchedule";

const IS_DEVNET = !RPC_URL.includes("mainnet");

function Skeleton() {
  return (
    <div
      className="border-y border-border animate-pulse"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <div className="grid md:grid-cols-2 gap-0 md:min-h-[520px]">
        <div className="bg-card p-5 md:p-8 flex flex-col gap-4">
          <div className="h-4 w-32 bg-border rounded" />
          <div className="h-8 w-48 bg-border rounded" />
          <div className="h-4 w-40 bg-border rounded" />
        </div>
        <div className="bg-border min-h-[280px]" />
      </div>
    </div>
  );
}

export default function AuctionCarousel() {
  const { slots, loading: scheduleLoading } = useAuctionSchedule();

  const [auctionData, setAuctionData] = useState(null);
  const [label, setLabel] = useState("TODAY'S AUCTION");
  const [mounted, setMounted] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [voteData, setVoteData] = useState(null);

  const autoAdvanceRef = useRef(null);

  // Derive today's or next upcoming auction
  useEffect(() => {
    if (scheduleLoading) return;
    const today = new Date().toISOString().split("T")[0];
    const todaySlot = slots.find((s) => s.dateStr === today);
    if (todaySlot) {
      setAuctionData({ ...todaySlot, date: todaySlot.dateStr });
      setLabel("TODAY'S AUCTION");
    } else {
      const next = slots.find((s) => s.dateStr >= today);
      if (next) {
        setAuctionData({ ...next, date: next.dateStr });
        setLabel(`UPCOMING · ${next.dateStr}`);
      }
    }
    setMounted(true);
  }, [slots, scheduleLoading]);

  // Fetch live vote data for bounty slides
  useEffect(() => {
    if (!auctionData?.date) return;
    fetch(`/api/bounty-vote?date=${auctionData.date}`)
      .then((r) => r.json())
      .then(setVoteData)
      .catch(() => {});
    const id = setInterval(() => {
      fetch(`/api/bounty-vote?date=${auctionData.date}`)
        .then((r) => r.json())
        .then(setVoteData)
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [auctionData?.date]);

  // Build slides: [auction, ...bounties]
  const slides = [];
  if (auctionData) {
    slides.push({ type: "auction" });
    const dayBounties = bounties[auctionData.date] || { human: [], ai: [] };
    const allBounties = [
      ...(dayBounties.human || []).map((h) => ({ ...h, submissionType: "Human" })),
      ...(dayBounties.ai || []).map((a) => ({ ...a, submissionType: "AI" })),
    ];
    for (const b of allBounties) slides.push({ type: "bounty", data: b });
  }
  const totalSlides = slides.length;

  // Auto-advance
  useEffect(() => {
    if (totalSlides <= 1 || paused) return;
    autoAdvanceRef.current = setInterval(() => {
      setSlideIndex((i) => (i + 1) % totalSlides);
    }, 6000);
    return () => clearInterval(autoAdvanceRef.current);
  }, [totalSlides, paused]);

  function prev() { setSlideIndex((i) => (i - 1 + totalSlides) % totalSlides); }
  function next() { setSlideIndex((i) => (i + 1) % totalSlides); }

  if (!mounted) return <Skeleton />;
  if (!auctionData) return null;

  const currentSlide = slides[slideIndex] || slides[0];
  const cluster = IS_DEVNET ? "?cluster=devnet" : "";

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="border-y border-border"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <div className="grid md:grid-cols-2 gap-0 relative md:min-h-[520px]">
        {/* ── Left panel ── */}
        <div className="bg-card md:border-r border-b md:border-b-0 border-border p-5 md:p-8 flex flex-col justify-between gap-6 order-2 md:order-1">
          {currentSlide?.type === "auction" ? (
            <>
              <div>
                <p className="text-xs text-muted tracking-widest mb-2">{label}</p>
                <h1 className="font-blackletter text-2xl md:text-4xl text-gold mb-2">
                  {auctionData.name}
                </h1>
                {auctionData.traits?.length > 0 && (
                  <p className="text-muted">{auctionData.traits.join(" · ")}</p>
                )}
                {auctionData.seller && (
                  <p className="text-xs text-muted mt-3">
                    Listed by {auctionData.seller.slice(0, 4)}…
                    {auctionData.seller.slice(-4)}
                  </p>
                )}
              </div>
              {auctionData.reservePrice != null && (
                <p className="text-xs text-muted">
                  Reserve:{" "}
                  <span className="text-foreground font-medium">
                    {(auctionData.reservePrice / LAMPORTS_PER_SOL).toFixed(3)} SOL
                  </span>
                  {" · "}
                  <a href="#current-auction" className="hover:text-foreground transition-colors">
                    ↓ Place a bid
                  </a>
                </p>
              )}
            </>
          ) : currentSlide?.type === "bounty" ? (
            <>
              <div>
                <p className="text-xs text-muted tracking-widest mb-2">ARTIST BOUNTY</p>
                <h2 className="font-blackletter text-2xl md:text-3xl text-gold mb-2">
                  {currentSlide.data.artistName ||
                    currentSlide.data.artist ||
                    currentSlide.data.model}
                </h2>
                <span className="inline-block text-xs px-2 py-0.5 border border-border text-muted mb-4">
                  {currentSlide.data.submissionType}
                </span>
                <div className="flex flex-wrap gap-4 mt-2">
                  {currentSlide.data.twitter && (
                    <a
                      href={`https://twitter.com/${currentSlide.data.twitter.replace("@", "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      X / Twitter ↗
                    </a>
                  )}
                  {currentSlide.data.instagram && (
                    <a
                      href={`https://instagram.com/${currentSlide.data.instagram.replace("@", "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      Instagram ↗
                    </a>
                  )}
                  {currentSlide.data.website && (
                    <a
                      href={currentSlide.data.website}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      Website ↗
                    </a>
                  )}
                </div>

                {/* Live vote tally */}
                {currentSlide.data.id && voteData && (() => {
                  const sid = currentSlide.data.id;
                  const votes = voteData.tallies?.[sid] || 0;
                  const total = Object.values(voteData.tallies || {}).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                  return (
                    <div className="mt-6 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>{votes} vote{votes !== 1 ? "s" : ""}</span>
                        {total > 0 && <span className="font-medium text-foreground">{pct}%</span>}
                      </div>
                      <div className="h-1 bg-border w-full">
                        <div className="h-1 bg-gold transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-muted">
                        <a href="/bounty" className="hover:text-foreground transition-colors">
                          {total === 0 ? "Be the first to vote ↗" : `${total} total votes · Vote on Bounty page ↗`}
                        </a>
                      </p>
                    </div>
                  );
                })()}
              </div>
              <div />
            </>
          ) : null}

          {/* Dot indicators */}
          {totalSlides > 1 && (
            <div className="flex gap-2 mt-auto pt-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === slideIndex ? "bg-gold" : "bg-border"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel (image) ── */}
        <div className="bg-card order-1 md:order-2 relative min-h-[280px]">
          {currentSlide?.type === "auction" && auctionData.image ? (
            <img
              src={auctionData.image}
              alt={auctionData.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : currentSlide?.type === "bounty" ? (
            <img
              src={currentSlide.data.imageUrl || currentSlide.data.image || ""}
              alt={currentSlide.data.artistName || "Bounty art"}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-border" />
          )}
        </div>

        {/* Arrows */}
        {totalSlides > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-card/80 border border-border text-muted hover:text-foreground transition-colors text-lg leading-none"
              aria-label="Previous slide"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-card/80 border border-border text-muted hover:text-foreground transition-colors text-lg leading-none"
              aria-label="Next slide"
            >
              ›
            </button>
          </>
        )}
      </div>
    </section>
  );
}
