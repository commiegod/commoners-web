"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import BracketView from "../../components/BracketView";
import { MAX_SCORE } from "../../../lib/bracket";

function shortenAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EntryPage() {
  const params = useParams();
  const entryId = params?.entryId;

  const [bracket, setBracket] = useState(null);
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!entryId) return;
    async function load() {
      try {
        const [bRes, eRes] = await Promise.all([
          fetch("/api/bracket"),
          fetch(`/api/bracket/entries/${entryId}`),
        ]);
        if (!bRes.ok) throw new Error("Failed to load bracket");
        if (!eRes.ok) throw new Error("Entry not found");
        const [bData, eData] = await Promise.all([bRes.json(), eRes.json()]);
        setBracket(bData);
        setEntry(eData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entryId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-card rounded" />
          <div className="h-4 w-40 bg-card rounded" />
          <div className="h-64 bg-card border border-border rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <Link href="/bracket" className="text-sm text-gold hover:underline">
          Back to bracket
        </Link>
      </div>
    );
  }

  if (!entry || !bracket) return null;

  const results = bracket.results ?? {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Back link */}
      <div className="mb-6">
        <Link href="/bracket" className="text-xs text-muted hover:text-foreground transition-colors">
          Back to bracket
        </Link>
      </div>

      {/* Entry header */}
      <div className="mb-6">
        <h1 className="font-blackletter text-3xl text-gold">{entry.username}</h1>
        <p className="text-xs text-muted mt-1">
          {shortenAddress(entry.walletAddress)}
          {entry.submittedAt ? ` — submitted ${formatDate(entry.submittedAt)}` : ""}
        </p>
      </div>

      {/* Score stats */}
      <div className="flex flex-wrap gap-6 mb-8">
        <div className="bg-card border border-border rounded px-5 py-3 text-center">
          <p className="text-2xl font-semibold text-foreground">
            {entry.score}
            <span className="text-base text-muted font-normal"> / {MAX_SCORE}</span>
          </p>
          <p className="text-xs text-muted uppercase tracking-widest mt-0.5">Score</p>
        </div>
        <div className="bg-card border border-border rounded px-5 py-3 text-center">
          <p className="text-2xl font-semibold text-foreground">
            #{entry.rank}
            <span className="text-base text-muted font-normal"> of {entry.total}</span>
          </p>
          <p className="text-xs text-muted uppercase tracking-widest mt-0.5">Rank</p>
        </div>
        <div className="bg-card border border-border rounded px-5 py-3 text-center">
          <p className="text-2xl font-semibold text-foreground">
            {entry.maxPossible}
            <span className="text-base text-muted font-normal"> max</span>
          </p>
          <p className="text-xs text-muted uppercase tracking-widest mt-0.5">Max Possible</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-gold/10 border border-gold/30" />
          Correct pick
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-50 border border-red-200" />
          Wrong pick
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-card border border-border" />
          Pending
        </span>
      </div>

      {/* Bracket with picks + results overlaid */}
      <div className="border border-border rounded overflow-hidden bg-background">
        <BracketView
          bracket={bracket}
          results={results}
          picks={entry.picks}
          mode="view"
        />
      </div>
    </div>
  );
}
