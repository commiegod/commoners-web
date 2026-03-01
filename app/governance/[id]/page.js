"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import proposalsData from "../../../data/proposals.json";
import {
  getCommonerCount,
  getThresholds,
  formatTimeLeft,
  msRemaining,
  PROPOSAL_TYPES,
  TOTAL_NFTS,
} from "../../../lib/commoners";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

const STATUS_STYLES = {
  active:  "bg-green-50 text-green-700 border border-green-300",
  passed:  "bg-green-50 text-green-700 border border-green-300",
  failed:  "bg-red-50 text-red-700 border border-red-300",
  queued:  "bg-blue-50 text-blue-700 border border-blue-300",
  pending: "bg-border/40 text-muted border border-border",
};

function shortAddr(addr) {
  if (!addr) return "—";
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function VoteBar({ for: forV, against, abstain, thresholds }) {
  const total = forV + against + abstain;
  if (total === 0) return null;
  const forPct = Math.round((forV / total) * 100);
  const againstPct = Math.round((against / total) * 100);
  const quorumMet = total >= thresholds.quorum;
  return (
    <div className="mt-3">
      <div className="flex h-1.5 overflow-hidden bg-border rounded-full">
        <div className="bg-green-500 transition-all" style={{ width: `${forPct}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${againstPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted mt-1">
        <span>{quorumMet ? "Quorum met ✓" : `Need ${thresholds.quorum - total} more votes for quorum`}</span>
        <span>{total} / {thresholds.quorum} quorum</span>
      </div>
    </div>
  );
}

export default function ProposalPage({ params }) {
  const { id } = params;
  const proposal = proposalsData.find((p) => p.id === id);

  const { connected, publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [commonerCount, setCommonerCount] = useState(0);
  const [checkingHolder, setCheckingHolder] = useState(false);
  const [govVotes, setGovVotes] = useState(null); // { tallies, voters }
  const [alloc, setAlloc] = useState({ yes: 0, no: 0, abstain: 0 });
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState("");

  async function fetchVotes() {
    try {
      const res = await fetch("/api/governance-vote");
      if (res.ok) {
        const all = await res.json();
        setGovVotes(all[id] ?? { tallies: { yes: 0, no: 0, abstain: 0 }, voters: {} });
      }
    } catch {}
  }

  useEffect(() => { fetchVotes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!walletAddress) { setCommonerCount(0); return; }
    setCheckingHolder(true);
    getCommonerCount(walletAddress).then((n) => {
      setCommonerCount(n);
      setCheckingHolder(false);
    });
  }, [walletAddress]);

  const handleVote = useCallback(async () => {
    if (!walletAddress) return;
    setVoting(true);
    setVoteError("");
    try {
      const res = await fetch("/api/governance-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: id, allocations: alloc, walletAddress }),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchVotes();
        setAlloc({ yes: 0, no: 0, abstain: 0 });
      } else {
        setVoteError(json.error || "Vote failed.");
      }
    } catch { setVoteError("Network error."); }
    finally { setVoting(false); }
  }, [walletAddress, alloc, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!proposal) {
    return (
      <div className="max-w-3xl">
        <Link href="/governance" className="text-sm text-muted hover:text-foreground transition-colors">
          ← Governance
        </Link>
        <p className="mt-6 text-muted">Proposal not found.</p>
      </div>
    );
  }

  const typeInfo = PROPOSAL_TYPES[proposal.type];
  const thresholds = getThresholds(proposal.type, proposal.treasurySol);
  const isActive = proposal.status === "active";
  const expired = isActive && msRemaining(proposal.endsAt) === 0;
  const timeLeft = isActive ? formatTimeLeft(proposal.endsAt) : null;

  const tallies = govVotes?.tallies ?? proposal.votes ?? { yes: 0, no: 0, abstain: 0 };
  const forVotes = tallies.yes ?? 0;
  const againstVotes = tallies.no ?? 0;
  const abstainVotes = tallies.abstain ?? 0;

  const myVote = govVotes?.voters?.[walletAddress] ?? null;
  const canVote = isActive && !expired && !!walletAddress && commonerCount > 0 && !myVote;
  const allocTotal = alloc.yes + alloc.no + alloc.abstain;

  return (
    <div className="max-w-4xl">
      {/* ── Back + status ── */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/governance"
          className="text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
        >
          ← Governance
        </Link>
        <span className="text-border">·</span>
        <span className="text-sm text-muted">Proposal #{proposal.id}</span>
        <span
          className={`text-xs px-2 py-0.5 font-medium capitalize ${STATUS_STYLES[proposal.status] ?? STATUS_STYLES.pending}`}
        >
          {proposal.status}
        </span>
      </div>

      {/* ── Title + meta ── */}
      <h1 className="font-blackletter text-3xl text-foreground leading-tight mb-2">
        {proposal.title}
      </h1>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mb-6">
        <span>Proposed by <span className="font-mono">{shortAddr(proposal.proposedBy)}</span></span>
        <span>·</span>
        <span>{typeInfo?.label ?? proposal.type}</span>
        {proposal.treasurySol > 0 && (
          <>
            <span>·</span>
            <span className="text-gold">{proposal.treasurySol} SOL treasury ask</span>
          </>
        )}
        <span>·</span>
        <span>
          {isActive && timeLeft ? timeLeft : `Ended ${new Date(proposal.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
        </span>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 border border-border mb-8">
        <div className="p-4 border-r border-border">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">Threshold</p>
          <p className="text-sm font-medium">{thresholds.majority}% majority</p>
          <p className="text-xs text-muted">{thresholds.quorum}/{TOTAL_NFTS} quorum</p>
        </div>
        <div className="p-4 border-r border-border">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">{isActive ? "Ends" : "Ended"}</p>
          <p className="text-sm font-medium">
            {new Date(proposal.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
          {timeLeft && <p className="text-xs text-muted">{timeLeft}</p>}
        </div>
        <div className="p-4">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">Total Votes</p>
          <p className="text-sm font-medium">{forVotes + againstVotes + abstainVotes}</p>
        </div>
      </div>

      {/* ── Two-column: description + vote sidebar ── */}
      <div className="grid md:grid-cols-[1fr_260px] gap-8">

        {/* Description */}
        <div>
          <h2 className="font-blackletter text-xl text-gold mb-4">Description</h2>
          <div className="text-sm text-muted leading-relaxed whitespace-pre-wrap">
            {proposal.description}
          </div>
        </div>

        {/* Vote sidebar */}
        <div>
          <div className="border border-border p-4 space-y-3 sticky top-6">
            {/* Tallies */}
            <div className="space-y-2 pb-3 border-b border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700 font-medium">{forVotes} For</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-600 font-medium">{againstVotes} Against</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{abstainVotes} Abstain</span>
              </div>
            </div>

            <VoteBar for={forVotes} against={againstVotes} abstain={abstainVotes} thresholds={thresholds} />

            {/* Voting UI */}
            {isActive && !expired && (
              <div className="pt-2">
                {myVote ? (
                  <div className="text-sm text-gold">
                    Voted ✓
                    {myVote.allocations && (
                      <p className="text-xs text-muted font-normal mt-1">
                        Yes: {myVote.allocations.yes ?? 0} · No: {myVote.allocations.no ?? 0} · Abstain: {myVote.allocations.abstain ?? 0}
                      </p>
                    )}
                  </div>
                ) : !connected ? (
                  <div>
                    <p className="text-xs text-muted mb-2">Connect wallet to vote.</p>
                    <WalletMultiButton
                      style={{
                        backgroundColor: "#1a1a1a",
                        color: "#f5f5f5",
                        fontSize: "0.75rem",
                        borderRadius: 0,
                        height: "auto",
                        padding: "0.375rem 0.75rem",
                        lineHeight: 1.5,
                        width: "100%",
                        justifyContent: "center",
                      }}
                    />
                  </div>
                ) : checkingHolder ? (
                  <p className="text-xs text-muted">Checking holdings…</p>
                ) : commonerCount === 0 ? (
                  <p className="text-xs text-muted">
                    Only Commoner NFT holders may vote.{" "}
                    <a href="https://magiceden.io/marketplace/midevilsnft" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
                      Magic Eden ↗
                    </a>
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted">{commonerCount} vote{commonerCount !== 1 ? "s" : ""} available</p>
                    {[
                      { key: "yes", label: "For", cls: "border-green-300 focus:border-green-500" },
                      { key: "no", label: "Against", cls: "border-red-300 focus:border-red-500" },
                      { key: "abstain", label: "Abstain", cls: "border-border" },
                    ].map(({ key, label, cls }) => (
                      <label key={key} className="flex items-center justify-between text-sm">
                        <span className="text-muted">{label}</span>
                        <input
                          type="number"
                          min={0}
                          max={commonerCount}
                          value={alloc[key]}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setAlloc((prev) => {
                              const others = Object.entries(prev)
                                .filter(([k]) => k !== key)
                                .reduce((s, [, v]) => s + v, 0);
                              return { ...prev, [key]: Math.min(val, commonerCount - others) };
                            });
                          }}
                          className={`w-16 bg-background border px-2 py-1 text-sm text-center focus:outline-none ${cls}`}
                        />
                      </label>
                    ))}
                    <div className="text-xs text-muted text-right">
                      {commonerCount - allocTotal} remaining
                    </div>
                    {voteError && <p className="text-xs text-red-600">{voteError}</p>}
                    <button
                      onClick={handleVote}
                      disabled={voting || allocTotal === 0}
                      className="w-full px-4 py-2 bg-gold text-card text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
                    >
                      {voting ? "Submitting…" : "Submit Vote"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {expired && (
              <p className="text-xs text-muted pt-2">Voting period has ended.</p>
            )}

            {!isActive && (
              <p className="text-xs text-muted pt-2">This proposal is {proposal.status}.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
