"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import BracketView from "../components/BracketView";
import { MAX_SCORE } from "../../lib/bracket";

function formatDeadline(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border animate-pulse">
      <div className="h-4 w-6 bg-card rounded" />
      <div className="h-4 flex-1 bg-card rounded" />
      <div className="h-4 w-16 bg-card rounded" />
    </div>
  );
}

const SHOW_INITIAL = 20;

export default function BracketPage() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [bracket, setBracket] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [bRes, eRes] = await Promise.all([
          fetch("/api/bracket"),
          fetch("/api/bracket/entries"),
        ]);
        if (!bRes.ok) throw new Error("Failed to load bracket");
        const bData = await bRes.json();
        setBracket(bData);

        if (eRes.ok) {
          const eData = await eRes.json();
          setEntries(eData.entries ?? []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const results = bracket?.results ?? {};
  const tournamentStarted =
    bracket?.status === "in_progress" || bracket?.status === "complete";
  const visibleEntries = showAll ? entries : entries.slice(0, SHOW_INITIAL);

  return (
    <div>
      {/* Hero banner — The Shoot — full-bleed */}
      <div
        style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
        className="overflow-hidden"
      >
        <Image
          src="/bracket/chadwick-shoot.png"
          alt="Chadwick going up for the shot"
          width={967}
          height={294}
          className="w-full object-cover"
          style={{ maxHeight: "220px", objectPosition: "center 20%" }}
          priority
        />
      </div>

      <div className="py-10">
        {/* Constrained content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-blackletter text-3xl text-gold mb-1">
              MidEvils March Madness 2026
            </h1>
            <p className="text-sm text-muted">
              Pick the bracket. Win the MidEvil.
            </p>
          </div>

          {error && (
            <div className="text-red-500 text-sm mb-6">{error}</div>
          )}

          {/* Prize callout */}
          <div className="mb-8 border border-gold/30 rounded overflow-hidden bg-card">
            <div className="flex flex-col sm:flex-row">
              {/* NFT portrait */}
              <div className="sm:w-48 shrink-0 bg-[#7a6b61]">
                <Image
                  src="/bracket/chadwick-nft.png"
                  alt="MidEvil #3614 — Chadwick"
                  width={400}
                  height={400}
                  className="w-full sm:h-full object-cover"
                  style={{ maxHeight: "240px" }}
                />
              </div>

              {/* Prize text */}
              <div className="flex-1 p-5 flex flex-col justify-center gap-3">
                <div>
                  <p className="text-xs text-gold uppercase tracking-widest mb-1">The Prize</p>
                  <h2 className="font-blackletter text-2xl text-foreground leading-tight">
                    MidEvil #3614 — Chadwick
                  </h2>
                </div>
                <p className="text-sm text-muted leading-relaxed">
                  First place takes home Chadwick. The winner of MidEvils March Madness 2026
                  will receive MidEvil #3614 transferred directly to their connected wallet —
                  no strings attached.
                </p>
                <p className="text-sm text-muted leading-relaxed">
                  Chadwick debuted in{" "}
                  <a
                    href="https://x.com/CommieGod/status/2025915421598044319"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold hover:underline"
                  >
                    the Mid of the Day series
                  </a>{" "}
                  on X. He belongs with someone who calls their shot.
                </p>
                <p className="text-xs text-muted/60">
                  MidEvils holders only — up to 5 entries per wallet.
                </p>
              </div>

              {/* Pose image — hidden on small screens */}
              <div className="hidden md:block w-44 shrink-0 bg-[#7a6b61]">
                <Image
                  src="/bracket/chadwick-pose.png"
                  alt="Chadwick posing with the ball"
                  width={512}
                  height={567}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: "center top" }}
                />
              </div>
            </div>
          </div>

          {/* Status banner */}
          {!loading && bracket && (
            <div className="mb-6">
              {bracket.status === "pending" && (
                <div className="bg-card border border-border rounded px-4 py-3 text-sm text-muted">
                  Brackets will be available after Selection Sunday. Check back soon.
                </div>
              )}
              {bracket.status === "open" && (
                <div className="bg-card border border-border rounded px-4 py-3 text-sm flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-foreground">
                    Entries open
                    {bracket.entryDeadline
                      ? ` — deadline: ${formatDeadline(bracket.entryDeadline)}`
                      : ""}
                  </span>
                  <Link
                    href="/bracket/enter"
                    className="bg-gold text-card font-semibold text-xs px-4 py-2 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    Enter Your Bracket
                  </Link>
                </div>
              )}
              {bracket.status === "in_progress" && (
                <div className="bg-card border border-border rounded px-4 py-3 text-sm text-foreground">
                  Tournament is underway.{" "}
                  <span className="text-muted">{entries.length} entries submitted.</span>
                </div>
              )}
              {bracket.status === "complete" && (
                <div className="bg-card border border-border rounded px-4 py-3 text-sm text-foreground">
                  Tournament complete. Final standings below.
                </div>
              )}
            </div>
          )}

          {/* Your entries (wallet connected) */}
          {walletAddress && !loading && (() => {
            const mine = entries.filter((e) => e.walletAddress === walletAddress);
            if (mine.length === 0) return null;
            return (
              <div className="mb-6">
                <h2 className="text-sm text-muted uppercase tracking-widest mb-3">Your Entries</h2>
                <div className="border border-border rounded bg-background divide-y divide-border">
                  {mine.map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/bracket/${entry.id}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-card transition-colors"
                    >
                      <span className="text-sm text-gold font-medium">{entry.username}</span>
                      {tournamentStarted && (
                        <span className="text-xs text-muted">{entry.score} pts</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Leaderboard + dribble image */}
          <div className="mb-2 flex gap-4 items-start">
            <div className="flex-1">
              <h2 className="text-sm text-muted uppercase tracking-widest mb-3">
                Leaderboard
              </h2>
              <div className="border border-border rounded bg-background">
                {loading ? (
                  <div className="p-4">
                    {[...Array(5)].map((_, i) => (
                      <SkeletonRow key={i} />
                    ))}
                  </div>
                ) : !tournamentStarted ? (
                  <div className="p-4">
                    <p className="text-sm text-muted">
                      {entries.length > 0
                        ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"} submitted.`
                        : "No entries yet."}
                    </p>
                    <p className="text-xs text-muted/60 mt-2">
                      Leaderboard unlocks when games begin.
                    </p>
                  </div>
                ) : entries.length === 0 ? (
                  <div className="p-4 text-sm text-muted">No entries yet.</div>
                ) : (
                  <>
                    <div className="divide-y divide-border">
                      {visibleEntries.map((entry) => {
                        const isMyEntry =
                          walletAddress && entry.walletAddress === walletAddress;
                        return (
                          <Link
                            key={entry.id}
                            href={`/bracket/${entry.id}`}
                            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-card transition-colors ${isMyEntry ? "border-l-2 border-gold" : ""}`}
                          >
                            <span className="text-xs text-muted/60 w-5 text-right shrink-0">
                              {entry.rank}
                            </span>
                            <span
                              className={`text-sm flex-1 truncate ${isMyEntry ? "text-gold font-medium" : "text-foreground"}`}
                            >
                              {entry.username}
                            </span>
                            <span className="text-xs text-muted whitespace-nowrap">
                              {entry.score} / {MAX_SCORE}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                    {entries.length > SHOW_INITIAL && (
                      <div className="px-4 py-2.5 border-t border-border">
                        <button
                          onClick={() => setShowAll((v) => !v)}
                          className="text-xs text-gold hover:underline cursor-pointer"
                        >
                          {showAll
                            ? "Show less"
                            : `Show all ${entries.length} entries`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Dribble image — decorative, only on larger screens */}
            <div className="hidden lg:block w-36 shrink-0 rounded overflow-hidden border border-border self-stretch" style={{ minHeight: "160px" }}>
              <Image
                src="/bracket/chadwick-dribble.png"
                alt="Chadwick dribbling"
                width={433}
                height={567}
                className="w-full h-full object-cover"
                style={{ objectPosition: "center top" }}
              />
            </div>
          </div>
        </div>

        {/* Bracket — full-bleed to escape layout container */}
        <div
          className="mt-8 px-2 sm:px-4"
          style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
        >
          <div className="mb-2 px-2">
            <h2 className="text-sm text-muted uppercase tracking-widest">Bracket</h2>
          </div>
          {loading ? (
            <div className="animate-pulse bg-card border border-border rounded h-64 mx-2" />
          ) : bracket ? (
            <div className="border border-border rounded overflow-hidden bg-background">
              <BracketView bracket={bracket} results={results} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
