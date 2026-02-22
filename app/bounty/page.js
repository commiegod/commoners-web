"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import { useWallet } from "@solana/wallet-adapter-react";
import bounties from "../../data/bounties.json";
import { useAuctionSchedule } from "../../lib/useAuctionSchedule";
import { getCommonerCount } from "../../lib/commoners";

const TYPES = ["Human", "AI-assisted"];

function SocialLink({ href, label }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-muted hover:text-foreground transition-colors"
    >
      {label} ↗
    </a>
  );
}

function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-2xl leading-none hover:opacity-70"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

export default function BountyPage() {
  const { slots, loading: scheduleLoading } = useAuctionSchedule();
  const [todaySlot, setTodaySlot] = useState(null);
  const [form, setForm] = useState({
    date: "",
    imageUrl: "",
    artistName: "",
    type: "Human",
    solanaAddress: "",
    twitter: "",
    instagram: "",
    website: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null); // null | "ok" | string error
  const [lightbox, setLightbox] = useState(null); // { src, alt }
  const { connected, publicKey } = useWallet();
  const [commonerCount, setCommonerCount] = useState(0);
  const [votes, setVotes] = useState({}); // { [dateStr]: { tallies, voters } }
  // localAlloc: { [dateStr]: { [submissionId]: number } } — pending split allocation
  const [localAlloc, setLocalAlloc] = useState({});
  const [submittingDay, setSubmittingDay] = useState(null); // dateStr being submitted
  const [voteError, setVoteError] = useState({}); // { [dateStr]: string }

  async function fetchVotes() {
    try {
      const res = await fetch("/api/bounty-vote");
      if (res.ok) setVotes(await res.json());
    } catch {}
  }

  useEffect(() => { fetchVotes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Commoner NFT count when wallet connects
  useEffect(() => {
    if (!publicKey) { setCommonerCount(0); return; }
    getCommonerCount(publicKey.toBase58()).then(setCommonerCount).catch(() => {});
  }, [publicKey?.toBase58()]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSplitVote(dateStr) {
    if (!publicKey) return;
    const allocations = localAlloc[dateStr] || {};
    const totalAllocated = Object.values(allocations).reduce((a, v) => a + v, 0);
    if (totalAllocated === 0) return;

    setSubmittingDay(dateStr);
    setVoteError((e) => ({ ...e, [dateStr]: "" }));
    try {
      const res = await fetch("/api/bounty-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          allocations,
          walletAddress: publicKey.toBase58(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchVotes();
        setLocalAlloc((a) => ({ ...a, [dateStr]: {} }));
      } else {
        setVoteError((e) => ({ ...e, [dateStr]: json.error || "Vote failed." }));
      }
    } catch {
      setVoteError((e) => ({ ...e, [dateStr]: "Network error." }));
    } finally {
      setSubmittingDay(null);
    }
  }

  function setAlloc(dateStr, subId, value) {
    setLocalAlloc((prev) => {
      const day = { ...(prev[dateStr] || {}) };
      const clamped = Math.max(0, Math.min(commonerCount, value));
      // Ensure total doesn't exceed commonerCount
      const others = Object.entries(day)
        .filter(([k]) => k !== subId)
        .reduce((s, [, v]) => s + v, 0);
      day[subId] = Math.min(clamped, commonerCount - others);
      return { ...prev, [dateStr]: day };
    });
  }

  useEffect(() => {
    if (scheduleLoading) return;
    const today = new Date().toISOString().split("T")[0];
    const slot = slots.find((s) => s.dateStr === today) || slots.find((s) => s.dateStr >= today);
    setTodaySlot(slot || null);
    if (slot && !form.date) {
      setForm((f) => ({ ...f, date: slot.dateStr }));
    }
  }, [slots, scheduleLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build upcoming date options from slots
  const today = new Date().toISOString().split("T")[0];
  const upcomingSlots = slots.filter((s) => s.dateStr >= today);

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const turnstileToken =
        e.target["cf-turnstile-response"]?.value || "";
      const res = await fetch("/api/bounty-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken }),
      });
      const json = await res.json();
      if (json.ok) {
        setSubmitResult("ok");
        setForm({
          date: todaySlot?.dateStr || "",
          imageUrl: "",
          artistName: "",
          type: "Human",
          solanaAddress: "",
          twitter: "",
          instagram: "",
          website: "",
        });
      } else {
        setSubmitResult(json.error || "Submission failed. Please try again.");
      }
    } catch {
      setSubmitResult("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Build grouped image wall from bounties.json
  const groupedByDate = Object.entries(bounties)
    .sort(([a], [b]) => b.localeCompare(a)) // most recent first
    .map(([dateStr, dayData]) => {
      const slotForDate = slots.find((s) => s.dateStr === dateStr);
      const allSubmissions = [
        ...(dayData.human || []).map((h) => ({ ...h, submissionType: "Human" })),
        ...(dayData.ai || []).map((a) => ({ ...a, submissionType: "AI" })),
      ];
      return { dateStr, slotForDate, allSubmissions };
    })
    .filter((g) => g.allSubmissions.length > 0);

  return (
    <div className="space-y-16">
      {/* ── Section 1: Header ── */}
      <section>
        <h1 className="font-blackletter text-3xl text-gold mb-3">
          Artist Bounty
        </h1>
        {todaySlot ? (
          <p className="text-muted leading-relaxed max-w-2xl">
            Today&apos;s auction features{" "}
            <span className="text-foreground font-medium">{todaySlot.name}</span>
            {todaySlot.traits?.length > 0 && (
              <> ({todaySlot.traits.join(" · ")})</>
            )}
            . Submit artwork inspired by this NFT. Human and AI submissions
            welcome. Accepted work earns COMMON from the auction rewards pool.
          </p>
        ) : (
          <p className="text-muted leading-relaxed max-w-2xl">
            Submit artwork inspired by the current auction NFT. Human and AI
            submissions welcome. Accepted work earns COMMON from the auction
            rewards pool.
          </p>
        )}
      </section>

      {/* ── Section 2: Submission Form ── */}
      <section>
        <h2 className="font-blackletter text-2xl text-gold mb-6">
          Submit Your Work
        </h2>
        <form
          onSubmit={handleSubmit}
          className="max-w-lg space-y-5 bg-card border border-border p-6"
        >
          {/* Auction date */}
          <div>
            <label className="block text-xs text-muted tracking-widest mb-2">
              AUCTION DATE
            </label>
            <select
              required
              value={form.date}
              onChange={(e) => setField("date", e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
            >
              <option value="">— Select date —</option>
              {upcomingSlots.map((s) => (
                <option key={s.dateStr} value={s.dateStr}>
                  {s.dateStr} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs text-muted tracking-widest mb-2">
              IMAGE URL
            </label>
            <input
              type="url"
              required
              value={form.imageUrl}
              onChange={(e) => setField("imageUrl", e.target.value)}
              placeholder="https://..."
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-muted/50"
            />
          </div>

          {/* Artist name */}
          <div>
            <label className="block text-xs text-muted tracking-widest mb-2">
              ARTIST / MODEL NAME
            </label>
            <input
              type="text"
              required
              value={form.artistName}
              onChange={(e) => setField("artistName", e.target.value)}
              placeholder="Your name or AI model used"
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-muted/50"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-muted tracking-widest mb-2">
              TYPE
            </label>
            <div className="flex gap-4">
              {TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={form.type === t}
                    onChange={() => setField("type", t)}
                    className="accent-foreground"
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>

          {/* Solana address */}
          <div>
            <label className="block text-xs text-muted tracking-widest mb-2">
              SOLANA WALLET ADDRESS <span className="text-muted normal-case tracking-normal">(for payment)</span>
            </label>
            <input
              type="text"
              required
              value={form.solanaAddress}
              onChange={(e) => setField("solanaAddress", e.target.value)}
              placeholder="Your Solana wallet address"
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-muted/50 font-mono"
            />
          </div>

          {/* Social links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted tracking-widest mb-2">
                TWITTER / X
              </label>
              <input
                type="text"
                value={form.twitter}
                onChange={(e) => setField("twitter", e.target.value)}
                placeholder="@handle"
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-muted/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted tracking-widest mb-2">
                INSTAGRAM
              </label>
              <input
                type="text"
                value={form.instagram}
                onChange={(e) => setField("instagram", e.target.value)}
                placeholder="@handle"
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-muted/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted tracking-widest mb-2">
                WEBSITE
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setField("website", e.target.value)}
                placeholder="https://..."
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-muted/50"
              />
            </div>
          </div>

          {submitResult === "ok" ? (
            <p className="text-sm text-green-700">
              Submission received. Approved submissions appear on this page
              after admin review.
            </p>
          ) : submitResult ? (
            <p className="text-sm text-red-600">{submitResult}</p>
          ) : null}

          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <div
              className="cf-turnstile"
              data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            />
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-gold text-card text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </form>

        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            async
            defer
          />
        )}
      </section>

      {/* ── Section 3: Image Wall ── */}
      {groupedByDate.length > 0 && (
        <section>
          <h2 className="font-blackletter text-2xl text-gold mb-8">
            Submissions
          </h2>
          <div className="space-y-12">
            {groupedByDate.map(({ dateStr, slotForDate, allSubmissions }) => {
              const isToday = dateStr === today;
              const dayVotes = votes[dateStr] || { tallies: {}, voters: {} };
              const myVote = connected
                ? dayVotes.voters[publicKey?.toBase58()]
                : null;
              // Total votes for this day (for percentage calculation)
              const totalVotes = Object.values(dayVotes.tallies).reduce((a, b) => a + b, 0);
              // Winner = submission with most votes (only shown for closed auctions)
              const winnerSubmissionId =
                !isToday && Object.keys(dayVotes.tallies).length > 0
                  ? Object.entries(dayVotes.tallies).sort(
                      ([, va], [, vb]) => vb - va
                    )[0]?.[0]
                  : null;
              return (
                <div key={dateStr}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs text-muted tracking-widest uppercase">
                      {dateStr}
                      {slotForDate && (
                        <span className="ml-2 text-foreground font-medium normal-case tracking-normal">
                          — {slotForDate.name}
                        </span>
                      )}
                      {isToday && (
                        <span className="ml-3 text-gold normal-case tracking-normal font-medium">
                          · Voting open
                        </span>
                      )}
                    </h3>
                    {totalVotes > 0 && (
                      <span className="text-xs text-muted">
                        {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {voteError[dateStr] && (
                    <p className="text-xs text-red-600 mb-3">{voteError[dateStr]}</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {allSubmissions.map((b, i) => {
                      const voteCount = b.id ? (dayVotes.tallies[b.id] || 0) : 0;
                      const isWinner = b.id && b.id === winnerSubmissionId && voteCount > 0;
                      return (
                        <div
                          key={i}
                          className="bg-card border border-border overflow-hidden"
                        >
                          <button
                            onClick={() =>
                              setLightbox({
                                src: b.imageUrl || b.image || "",
                                alt: b.artistName || b.artist || "Bounty art",
                              })
                            }
                            className="w-full block"
                          >
                            <img
                              src={b.imageUrl || b.image || ""}
                              alt={b.artistName || b.artist || "Bounty art"}
                              className="w-full aspect-square object-cover hover:opacity-90 transition-opacity"
                            />
                          </button>
                          <div className="p-3 space-y-1">
                            <p className="text-sm font-medium truncate">
                              {b.artistName || b.artist || b.model}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs px-1.5 py-0.5 border border-border text-muted">
                                {b.submissionType}
                              </span>
                              {isWinner && (
                                <span className="text-xs font-semibold text-gold">
                                  Winner
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {b.twitter && (
                                <SocialLink
                                  href={`https://twitter.com/${b.twitter.replace("@", "")}`}
                                  label="X"
                                />
                              )}
                              {b.instagram && (
                                <SocialLink
                                  href={`https://instagram.com/${b.instagram.replace("@", "")}`}
                                  label="IG"
                                />
                              )}
                              {b.website && (
                                <SocialLink href={b.website} label="Web" />
                              )}
                            </div>
                            {/* Vote row — only shown for submissions with an id */}
                            {b.id && (
                              <div className="pt-2 mt-1 border-t border-border space-y-1.5">
                                {/* Progress bar */}
                                {totalVotes > 0 && (
                                  <div className="h-1 bg-border w-full">
                                    <div
                                      className="h-1 bg-gold transition-all duration-500"
                                      style={{ width: `${Math.round((voteCount / totalVotes) * 100)}%` }}
                                    />
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted">
                                    {voteCount} vote{voteCount !== 1 ? "s" : ""}
                                    {totalVotes > 0 && (
                                      <span className="ml-1 font-medium text-foreground">
                                        ({Math.round((voteCount / totalVotes) * 100)}%)
                                      </span>
                                    )}
                                  </span>
                                  {isToday && myVote?.allocations?.[b.id] > 0 ? (
                                    <span className="text-xs text-green-700">+{myVote.allocations[b.id]} ✓</span>
                                  ) : isToday && !myVote && connected && commonerCount > 0 ? (
                                    <input
                                      type="number"
                                      min={0}
                                      max={commonerCount}
                                      value={(localAlloc[dateStr]?.[b.id]) || 0}
                                      onChange={(e) => setAlloc(dateStr, b.id, parseInt(e.target.value) || 0)}
                                      className="w-14 bg-background border border-border px-2 py-0.5 text-xs text-center focus:outline-none focus:border-foreground"
                                    />
                                  ) : isToday && !connected ? (
                                    <span className="text-xs text-muted italic">Connect wallet</span>
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Split vote submit row */}
                  {isToday && connected && !myVote && commonerCount > 0 && (() => {
                    const dayAlloc = localAlloc[dateStr] || {};
                    const totalAllocated = Object.values(dayAlloc).reduce((a, v) => a + v, 0);
                    const remaining = commonerCount - totalAllocated;
                    return (
                      <div className="mt-4 flex items-center gap-4 flex-wrap">
                        <span className="text-xs text-muted">
                          {remaining} of {commonerCount} vote{commonerCount !== 1 ? "s" : ""} remaining
                        </span>
                        <button
                          onClick={() => handleSplitVote(dateStr)}
                          disabled={submittingDay === dateStr || totalAllocated === 0}
                          className="px-4 py-1.5 bg-gold text-card text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
                        >
                          {submittingDay === dateStr ? "Submitting…" : "Submit Votes"}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {lightbox && (
        <Lightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
