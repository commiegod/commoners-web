"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import BracketView from "../../components/BracketView";
import { MAX_SCORE, getTeamById } from "../../../lib/bracket";

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
  const scores  = bracket.scores  ?? {};
  const champTeam = entry.picks?.champ ? getTeamById(bracket, entry.picks.champ) : null;

  return (
    <div>
      {/* Banner */}
      <div style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }} className="overflow-hidden">
        <Image
          src="/bracket/chadwick-shoot.png"
          alt="MidEvils March Madness 2026"
          width={967}
          height={294}
          className="w-full object-cover"
          style={{ maxHeight: "160px", objectPosition: "center 20%" }}
          priority
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Back link */}
        <div className="mb-5">
          <Link href="/bracket" className="text-xs text-muted hover:text-foreground transition-colors">
            Back to bracket
          </Link>
        </div>

        {/* Header card */}
        <div className="bg-card border border-border rounded overflow-hidden mb-6">
          <div className="flex flex-col sm:flex-row sm:items-stretch">
            {/* Champion callout — left accent */}
            {champTeam && (
              <div className="border-b sm:border-b-0 sm:border-r border-gold/30 bg-gold/5 px-6 py-5 flex flex-col justify-center items-center text-center sm:min-w-[160px]">
                <p className="text-xs text-gold/70 uppercase tracking-widest mb-1">Picks to win</p>
                <p className="font-blackletter text-2xl text-gold leading-tight">{champTeam.shortName ?? champTeam.name}</p>
                <p className="text-xs text-muted mt-1">#{champTeam.seed} seed</p>
              </div>
            )}

            {/* Entry name + meta */}
            <div className="flex-1 px-6 py-5">
              <h1 className="font-blackletter text-3xl text-foreground leading-tight mb-1">{entry.username}</h1>
              <p className="text-xs text-muted">
                {shortenAddress(entry.walletAddress)}
                {entry.submittedAt ? ` — submitted ${formatDate(entry.submittedAt)}` : ""}
              </p>
            </div>

            {/* Stats */}
            <div className="border-t sm:border-t-0 sm:border-l border-border flex divide-x divide-border">
              <div className="flex-1 px-5 py-4 text-center flex flex-col justify-center">
                <p className="text-2xl font-semibold text-foreground leading-none">
                  {entry.score}
                  <span className="text-sm text-muted font-normal"> / {MAX_SCORE}</span>
                </p>
                <p className="text-xs text-muted uppercase tracking-widest mt-1">Score</p>
              </div>
              <div className="flex-1 px-5 py-4 text-center flex flex-col justify-center">
                <p className="text-2xl font-semibold text-foreground leading-none">
                  #{entry.rank}
                  <span className="text-sm text-muted font-normal"> of {entry.total}</span>
                </p>
                <p className="text-xs text-muted uppercase tracking-widest mt-1">Rank</p>
              </div>
              <div className="flex-1 px-5 py-4 text-center flex flex-col justify-center">
                <p className="text-2xl font-semibold text-foreground leading-none">
                  {entry.maxPossible}
                  <span className="text-sm text-muted font-normal"> max</span>
                </p>
                <p className="text-xs text-muted uppercase tracking-widest mt-1">Max Possible</p>
              </div>
            </div>
          </div>

          {/* Tiebreaker + legend footer */}
          <div className="border-t border-border px-6 py-3 flex flex-wrap items-center gap-4 bg-background">
            {entry.tiebreaker != null && (
              <span className="text-xs text-muted">
                Tiebreaker: <span className="text-foreground font-medium">{entry.tiebreaker}</span> combined pts
              </span>
            )}
            <div className="flex flex-wrap gap-4 text-xs text-muted ml-auto">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-gold/10 border border-gold/30" />
                Correct
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-red-50 border border-red-200" />
                Wrong
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-card border border-border" />
                Pending
              </span>
            </div>
          </div>
        </div>

        {/* Bracket */}
        <div className="border border-border rounded overflow-hidden bg-background">
          <BracketView
            bracket={bracket}
            results={results}
            scores={scores}
            picks={entry.picks}
            mode="view"
          />
        </div>
      </div>
    </div>
  );
}
