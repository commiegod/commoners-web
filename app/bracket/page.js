"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function BracketPage() {
  const [bracket, setBracket] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  const topEntries = entries.slice(0, 10);
  const tournamentStarted =
    bracket?.status === "in_progress" || bracket?.status === "complete";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-blackletter text-3xl text-gold">
          MidEvils March Madness 2026
        </h1>
      </div>

      {error && (
        <div className="text-red-500 text-sm mb-6">{error}</div>
      )}

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

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Bracket section (~70%) */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm text-muted uppercase tracking-widest mb-3">
            Bracket
          </h2>
          {loading ? (
            <div className="animate-pulse bg-card border border-border rounded h-64" />
          ) : bracket ? (
            <div className="border border-border rounded overflow-hidden bg-background">
              <BracketView bracket={bracket} results={results} />
            </div>
          ) : null}
        </div>

        {/* Leaderboard sidebar (~30%) */}
        <div className="w-full lg:w-72 shrink-0">
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
            ) : topEntries.length === 0 ? (
              <div className="p-4 text-sm text-muted">No entries yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {topEntries.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/bracket/${entry.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-card transition-colors"
                  >
                    <span className="text-xs text-muted/60 w-5 text-right shrink-0">
                      {entry.rank}
                    </span>
                    <span className="text-sm flex-1 truncate text-foreground">
                      {entry.username}
                    </span>
                    <span className="text-xs text-muted whitespace-nowrap">
                      {entry.score} / {MAX_SCORE}
                    </span>
                  </Link>
                ))}
                {entries.length > 10 && (
                  <div className="px-4 py-2 text-xs text-muted/60">
                    +{entries.length - 10} more entries
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
