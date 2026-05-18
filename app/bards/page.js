"use client";

// The Bards' Hall — repositioned from /bounty.
//
// Phase 1 reposition (no data refactor):
//   * No $COMMON references — exposure-based, not pay-based.
//   * Artists submit a "tribute" tied to a MidEvil being auctioned.
//   * Their socials get prominent placement next to the artwork — the
//     auction's audience becomes their funnel.
//   * Voting still tracks community sentiment but is now "people's choice"
//     rather than a rewards allocator.
//
// Internal API names (/api/bounty-submit, /api/bounty-vote, /api/bounty-upload)
// and the storage shape (data/bounties.json keyed by date) are unchanged in
// Phase 1. Phase 2 (post-mainnet) will re-key submissions by NFT mint so
// multi-auction works correctly.

import { useState, useEffect } from "react";
import Script from "next/script";
import { upload } from "@vercel/blob/client";
import { useWallet } from "@solana/wallet-adapter-react";
import bounties from "../../data/bounties.json";
import { useAuctionSchedule } from "../../lib/useAuctionSchedule";
import { getCommonerCount } from "../../lib/commoners";
import { RPC_URL } from "../../lib/programClient";

const IS_DEVNET = !RPC_URL.includes("mainnet");

const TYPES = ["Human", "AI-assisted"];
const IMAGE_MODES = ["url", "upload"];

function SocialLink({ href, label }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-foreground hover:text-gold transition-colors font-medium"
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
        className="absolute top-4 right-4 text-white text-2xl leading-none hover:opacity-70 cursor-pointer"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

export default function BardsPage() {
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
  const [imageMode, setImageMode] = useState("url");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const { connected, publicKey } = useWallet();
  const [commonerCount, setCommonerCount] = useState(0);
  const [votes, setVotes] = useState({});
  const [localAlloc, setLocalAlloc] = useState({});
  const [submittingDay, setSubmittingDay] = useState(null);
  const [voteError, setVoteError] = useState({});

  async function fetchVotes() {
    try {
      const res = await fetch("/api/bounty-vote");
      if (res.ok) setVotes(await res.json());
    } catch {}
  }

  useEffect(() => { fetchVotes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const utcToday = new Date().toISOString().split("T")[0];
  const upcomingSlots = slots.filter((s) => s.dateStr >= utcToday);

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    setField("imageUrl", "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);
    try {
      let imageUrl = form.imageUrl;

      if (imageMode === "upload" && uploadFile) {
        setUploading(true);
        try {
          const ext = uploadFile.name.split(".").pop()?.toLowerCase() || "jpg";
          const blob = await upload(`bounty/${Date.now()}.${ext}`, uploadFile, {
            access: "public",
            handleUploadUrl: "/api/bounty-upload",
          });
          imageUrl = blob.url;
        } catch (upErr) {
          setSubmitResult(upErr.message || "Upload failed. Please try again.");
          setUploading(false);
          setSubmitting(false);
          return;
        }
        setUploading(false);
      }

      const turnstileToken = e.target["cf-turnstile-response"]?.value || "";
      const res = await fetch("/api/bounty-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, imageUrl, turnstileToken }),
      });
      let json;
      try {
        json = await res.json();
      } catch {
        setSubmitResult(`Server error (${res.status}). Please try again.`);
        return;
      }
      if (json.ok) {
        setSubmitResult("ok");
        setUploadFile(null);
        setUploadPreview(null);
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
      setSubmitResult("Connection failed. Please check your network and try again.");
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  }

  const groupedByDate = Object.entries(bounties)
    .sort(([a], [b]) => b.localeCompare(a))
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
    <div>
      {/* Hero banner — full-bleed */}
      <div
        style={{
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          height: "220px",
          backgroundImage: "url('/banner-bounty.png')",
          backgroundSize: "cover",
          backgroundPosition: "center 20%",
        }}
        className="mb-8"
      />

      <div className="space-y-16">
      {/* ── Section 1: Header ── */}
      <section>
        <p className="font-blackletter text-[11px] tracking-[0.3em] text-muted mb-2 uppercase">
          The Bards' Hall
        </p>
        <h1 className="font-blackletter text-3xl md:text-4xl text-foreground mb-4">
          Tributes for the MidEvils
        </h1>
        {IS_DEVNET && (
          <div className="mb-5 max-w-2xl px-4 py-3 border border-amber-300/60 rounded bg-amber-50/60 text-sm text-amber-800 leading-relaxed">
            <span className="font-semibold">Testing phase.</span> The auction
            program is currently running on Solana devnet. Artists are welcome
            to submit tributes and help us shape the showcase ahead of mainnet.
          </div>
        )}
        <p className="text-muted leading-relaxed max-w-2xl mb-3">
          Bards offer artwork — &quot;tributes&quot; — interpreting a MidEvil
          that&apos;s up for auction. There&apos;s no token reward and no
          payment changes hands. What you get instead is placement: your art
          and your socials shown beside the auction it belongs to, in front of
          the buyer who&apos;s about to commit SOL to that exact piece. The
          tribute belongs to you. The MidEvils community is your audience.
        </p>
        {todaySlot ? (
          <>
            <p className="text-muted leading-relaxed max-w-2xl">
              Up next on the block:{" "}
              <span className="text-foreground font-medium">{todaySlot.name}</span>
              . Human work, AI-assisted work, sketches, finished pieces — all
              welcome. Approved tributes appear below.
            </p>
            {todaySlot.image && (
              <div className="mt-6">
                <img
                  src={todaySlot.image}
                  alt={todaySlot.name}
                  className="h-64 w-64 object-cover border border-border"
                />
              </div>
            )}
          </>
        ) : (
          <p className="text-muted leading-relaxed max-w-2xl">
            Pick a MidEvil from the schedule below and submit your
            interpretation. Human and AI-assisted work both welcome.
          </p>
        )}
      </section>

      {/* ── Section 2: Submission Form ── */}
      <section>
        <h2 className="font-blackletter text-2xl text-foreground mb-2">
          Offer a Tribute
        </h2>
        <p className="text-sm text-muted leading-relaxed max-w-lg mb-6">
          One submission per piece. We&apos;ll review and publish approved
          work below — usually same day. Your socials are the link out: make
          sure the handles you want featured are filled in.
        </p>
        <form
          onSubmit={handleSubmit}
          className="max-w-lg space-y-5 bg-card border border-border p-6"
        >
          {/* Auction date */}
          <div>
            <label className="block text-xs text-muted tracking-widest mb-2">
              MIDEVIL UP FOR AUCTION
            </label>
            <select
              required
              value={form.date}
              onChange={(e) => setField("date", e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground"
            >
              <option value="">— Select an auction —</option>
              {upcomingSlots.map((s) => (
                <option key={s.dateStr} value={s.dateStr}>
                  {s.dateStr} — {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted/70 mt-1">
              Pick the auction your tribute is interpreting. Multi-auction
              support comes post-mainnet — for now, this is keyed by date.
            </p>
          </div>

          {/* Image — URL or upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-muted tracking-widest">IMAGE</label>
              <div className="flex gap-0 border border-border text-xs">
                {IMAGE_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setImageMode(m)}
                    className={`px-3 py-0.5 rounded-full capitalize transition-colors ${
                      imageMode === m
                        ? "bg-foreground text-background"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {m === "url" ? "Link URL" : "Upload"}
                  </button>
                ))}
              </div>
            </div>
            {imageMode === "url" ? (
              <input
                type="url"
                required
                value={form.imageUrl}
                onChange={(e) => setField("imageUrl", e.target.value)}
                placeholder="https://..."
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted/50"
              />
            ) : (
              <div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                  required={!uploadFile}
                  onChange={handleFileChange}
                  className="w-full text-sm text-muted file:mr-3 file:py-1.5 file:px-3 file:border file:border-border file:bg-background file:text-sm file:text-foreground file:cursor-pointer hover:file:text-foreground"
                />
                {uploadPreview && (
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    className="mt-2 h-24 object-contain border border-border"
                  />
                )}
                <p className="mt-1 text-xs text-muted">Max 10 MB · JPG, PNG, GIF, WebP</p>
              </div>
            )}
          </div>

          {/* Artist name */}
          <div>
            <label className="block text-xs text-muted tracking-widest mb-2">
              BARD / MODEL NAME
            </label>
            <input
              type="text"
              required
              value={form.artistName}
              onChange={(e) => setField("artistName", e.target.value)}
              placeholder="Your name or AI model used"
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted/50"
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
              SOLANA WALLET ADDRESS
            </label>
            <input
              type="text"
              required
              value={form.solanaAddress}
              onChange={(e) => setField("solanaAddress", e.target.value)}
              placeholder="Your Solana wallet address"
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted/50 font-mono"
            />
            <p className="text-xs text-muted/70 mt-1">
              Used to credit you on-chain if the DAO ever votes future
              tribute rewards. No payment today — exposure only.
            </p>
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
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted/50"
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
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted/50"
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
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted/50"
              />
            </div>
          </div>

          {submitResult === "ok" ? (
            <p className="text-sm text-green-700">
              Tribute received. Approved work appears below after admin
              review.
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
            disabled={submitting || uploading}
            className="px-5 py-2 bg-foreground text-background text-sm font-blackletter tracking-wider rounded-full hover:opacity-85 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {uploading ? "Uploading…" : submitting ? "Offering…" : "Offer Tribute"}
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

      {/* ── Section 3: Tributes Wall ── */}
      {groupedByDate.length === 0 && (
        <section>
          <div className="border border-border p-6 max-w-lg text-sm text-muted leading-relaxed">
            <p className="font-medium text-foreground mb-2">
              No tributes yet.
            </p>
            <p>
              The hall is open. The first bard to interpret an auctioned
              MidEvil gets the spotlight — image, name, and socials shown
              beside the auction it belongs to.
            </p>
          </div>
        </section>
      )}
      {groupedByDate.length > 0 && (
        <section>
          <h2 className="font-blackletter text-2xl text-foreground mb-2">
            Recent Tributes
          </h2>
          <p className="text-sm text-muted leading-relaxed max-w-xl mb-8">
            Approved work, grouped by the auction it interprets. Click an
            image to see it full-size; click a handle to find the bard.
          </p>
          <div className="space-y-12">
            {groupedByDate.map(({ dateStr, slotForDate, allSubmissions }) => {
              const isToday = dateStr === utcToday;
              const dayVotes = votes[dateStr] || { tallies: {}, voters: {} };
              const myVote = connected
                ? dayVotes.voters[publicKey?.toBase58()]
                : null;
              const totalVotes = Object.values(dayVotes.tallies).reduce((a, b) => a + b, 0);
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
                        <span className="ml-3 text-foreground normal-case tracking-normal font-medium">
                          · People&apos;s choice open
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
                                alt: b.artistName || b.artist || "Tribute art",
                              })
                            }
                            className="w-full block cursor-pointer"
                          >
                            <img
                              src={b.imageUrl || b.image || ""}
                              alt={b.artistName || b.artist || "Tribute art"}
                              className="w-full aspect-square object-cover hover:opacity-90 transition-opacity"
                            />
                          </button>
                          <div className="p-3 space-y-2">
                            {/* Artist credit — bigger and more prominent */}
                            <p className="font-blackletter text-base text-foreground truncate">
                              {b.artistName || b.artist || b.model}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs px-1.5 py-0.5 border border-border text-muted">
                                {b.submissionType}
                              </span>
                              {isWinner && (
                                <span className="text-xs font-semibold text-foreground border border-foreground/40 px-1.5 py-0.5">
                                  People's choice
                                </span>
                              )}
                            </div>
                            {/* Socials — heavier weight, full width */}
                            {(b.twitter || b.instagram || b.website) && (
                              <div className="flex flex-wrap gap-3 pt-1 border-t border-border/60">
                                {b.twitter && (
                                  <SocialLink
                                    href={`https://twitter.com/${b.twitter.replace("@", "")}`}
                                    label={b.twitter.startsWith("@") ? b.twitter : `@${b.twitter}`}
                                  />
                                )}
                                {b.instagram && (
                                  <SocialLink
                                    href={`https://instagram.com/${b.instagram.replace("@", "")}`}
                                    label={`IG: ${b.instagram.startsWith("@") ? b.instagram : `@${b.instagram}`}`}
                                  />
                                )}
                                {b.website && (
                                  <SocialLink href={b.website} label="Website" />
                                )}
                              </div>
                            )}
                            {/* Vote row — only shown for submissions with an id */}
                            {b.id && (
                              <div className="pt-2 mt-1 border-t border-border space-y-1.5">
                                {totalVotes > 0 && (
                                  <div className="h-1 bg-border w-full">
                                    <div
                                      className="h-1 bg-foreground transition-all duration-500"
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
                                    <span className="text-xs text-muted italic">Connect wallet to vote</span>
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
                          className="px-4 py-1.5 bg-foreground text-background text-sm font-blackletter tracking-wider rounded-full hover:opacity-85 disabled:opacity-40 transition-opacity cursor-pointer"
                        >
                          {submittingDay === dateStr ? "Submitting…" : "Cast Votes"}
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
    </div>
  );
}
