"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import proposalsData from "../../data/proposals.json";
import {
  getCommonerCount,
  getThresholds,
  formatTimeLeft,
  msRemaining,
  PROPOSAL_TYPES,
  TOTAL_NFTS,
} from "../../lib/commoners";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active: "bg-gold/10 text-gold border border-gold/30",
  passed: "bg-green-50 text-green-700 border border-green-300",
  failed: "bg-red-50 text-red-700 border border-red-300",
  queued: "bg-blue-50 text-blue-700 border border-blue-300",
};

// ── sub-components ────────────────────────────────────────────────────────────

function VoteBar({ votes, thresholds }) {
  const total = votes.yes + votes.no + votes.abstain;
  if (total === 0) return null;

  const yesPct = Math.round((votes.yes / total) * 100);
  const noPct = Math.round((votes.no / total) * 100);
  const quorumPct = Math.round((total / TOTAL_NFTS) * 100);
  const quorumMet = total >= thresholds.quorum;
  const majorityMet = yesPct >= thresholds.majority;

  return (
    <div className="mt-4 space-y-3">
      <div>
        <div className="flex h-2 overflow-hidden bg-border rounded-full relative">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${yesPct}%` }}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${noPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-gold/60"
            style={{ left: `${thresholds.majority}%` }}
            title={`${thresholds.majority}% threshold`}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-muted">
          <span className="text-green-700">
            {votes.yes} Yes ({yesPct}%)
          </span>
          <span>{votes.abstain} Abstain</span>
          <span className="text-red-600">
            {votes.no} No ({noPct}%)
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={quorumMet ? "text-green-700" : "text-muted"}>
          Quorum: {total}/{thresholds.quorum} NFTs ({quorumPct}%){" "}
          {quorumMet ? "✓" : `— need ${thresholds.quorum - total} more`}
        </span>
        <span className={majorityMet && quorumMet ? "text-green-700" : "text-muted"}>
          Threshold: {thresholds.majority}%{" "}
          {majorityMet ? "✓" : `— at ${yesPct}%`}
        </span>
      </div>
    </div>
  );
}

function ThresholdBadge({ thresholds, type }) {
  const typeInfo = PROPOSAL_TYPES[type];
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
      <span className="px-1.5 py-0.5 bg-border/50 border border-border">
        {thresholds.majority}% majority
      </span>
      <span className="px-1.5 py-0.5 bg-border/50 border border-border">
        {thresholds.quorum}/{TOTAL_NFTS} quorum
      </span>
      <span className="px-1.5 py-0.5 bg-border/50 border border-border">
        72h window
      </span>
      {thresholds.needsFutarchy && (
        <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-300 text-blue-700">
          + futarchy (Phase 4)
        </span>
      )}
      {typeInfo?.treasury && !thresholds.needsFutarchy && (
        <span className="px-1.5 py-0.5 bg-gold/10 border border-gold/30 text-gold">
          treasury vote
        </span>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  walletAddress,
  commonerCount,
  onVote,
  myVote,
  voteError,
  voting,
  realVotes,
}) {
  const thresholds = getThresholds(proposal.type, proposal.treasurySol);
  const typeInfo = PROPOSAL_TYPES[proposal.type];
  const isActive = proposal.status === "active";
  const timeLeft = isActive ? formatTimeLeft(proposal.endsAt) : null;
  const expired = isActive && msRemaining(proposal.endsAt) === 0;
  const displayVotes = realVotes || proposal.votes;

  const canVote =
    isActive &&
    !expired &&
    !!walletAddress &&
    commonerCount > 0 &&
    !myVote;

  return (
    <div className="bg-card border border-border p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="font-semibold">{proposal.title}</h3>
        <div className="flex items-center gap-2 shrink-0">
          {timeLeft && (
            <span className="text-xs text-muted">{timeLeft}</span>
          )}
          <span
            className={`text-xs px-2 py-0.5 ${STATUS_STYLES[proposal.status]}`}
          >
            {proposal.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="mb-2">
        <span className="text-xs text-muted">{typeInfo?.label ?? proposal.type}</span>
        <ThresholdBadge thresholds={thresholds} type={proposal.type} />
      </div>

      <p className="text-sm text-muted mb-1">{proposal.description}</p>

      {proposal.treasurySol > 0 && (
        <p className="text-xs text-gold mb-1">
          Treasury request: {proposal.treasurySol} SOL
        </p>
      )}

      <p className="text-xs text-muted">
        Proposed by{" "}
        <span className="font-mono">
          {proposal.proposedBy
            ? `${proposal.proposedBy.slice(0, 4)}…${proposal.proposedBy.slice(-4)}`
            : proposal.proposedBy}
        </span>{" "}
        &middot; {isActive ? "Ends" : "Ended"}{" "}
        {new Date(proposal.endsAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      <VoteBar votes={displayVotes} thresholds={thresholds} />

      {isActive && (
        <div className="mt-4">
          {myVote ? (
            <p className="text-sm text-gold">
              You voted:{" "}
              <span className="font-semibold">{myVote.toUpperCase()}</span>
              {commonerCount > 1 && (
                <span className="text-muted font-normal">
                  {" "}({commonerCount} NFTs)
                </span>
              )}
            </p>
          ) : !walletAddress ? (
            <p className="text-xs text-muted">Connect your wallet to vote.</p>
          ) : commonerCount === 0 ? (
            <p className="text-xs text-muted">
              Only Commoner NFT holders may vote.{" "}
              <a
                href="https://magiceden.io/marketplace/midevilsnft"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:underline"
              >
                View on Magic Eden ↗
              </a>
            </p>
          ) : expired ? (
            <p className="text-xs text-muted">Voting period has ended.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {["yes", "no", "abstain"].map((choice) => (
                  <button
                    key={choice}
                    onClick={() => onVote(proposal.id, choice)}
                    disabled={voting === proposal.id}
                    className={`px-4 py-1.5 text-sm disabled:opacity-50 transition-colors ${
                      choice === "yes"
                        ? "bg-green-50 border border-green-300 text-green-700 hover:bg-green-100"
                        : choice === "no"
                        ? "bg-red-50 border border-red-300 text-red-700 hover:bg-red-100"
                        : "bg-card border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {voting === proposal.id
                      ? "Voting…"
                      : `Vote ${choice.charAt(0).toUpperCase() + choice.slice(1)}`}
                  </button>
                ))}
              </div>
              {voteError && (
                <p className="text-xs text-red-600">{voteError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── proposal submission form ───────────────────────────────────────────────────

const EMPTY_FORM = {
  type: "community-initiative",
  title: "",
  description: "",
  treasurySol: "",
};

function SubmitForm({ onClose, walletAddress, commonerCount }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [stage, setStage] = useState("form"); // "form" | "preview" | "done"
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const typeInfo = PROPOSAL_TYPES[form.type];
  const solAmount = parseFloat(form.treasurySol) || 0;
  const thresholds = getThresholds(form.type, solAmount);

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const short = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : "";

  const markdownPreview = `**Type:** ${typeInfo?.label}
**Proposer:** ${short}
**Title:** ${form.title}
**Treasury request:** ${solAmount > 0 ? `${solAmount} SOL` : "None"}
**Required threshold:** ${thresholds.majority}% majority, ${thresholds.quorum}/${TOTAL_NFTS} quorum${thresholds.needsFutarchy ? " + futarchy" : ""}

${form.description}`;

  async function handleFinalSubmit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/governance-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          description: form.description,
          treasurySol: solAmount,
          walletAddress,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setStage("done");
      } else {
        setSubmitError(json.error || "Submission failed.");
      }
    } catch {
      setSubmitError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "done") {
    return (
      <div className="bg-card border border-border p-5">
        <h3 className="font-semibold mb-3">Proposal Submitted</h3>
        <p className="text-sm text-muted mb-4">
          Your proposal has been sent to{" "}
          <span className="text-gold">#governance</span> on Discord for community
          review. Once an admin approves it, it will appear here open for a
          72-hour vote.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-1.5 border border-border text-muted text-sm hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  if (stage === "preview") {
    return (
      <div className="bg-card border border-border p-5">
        <p className="text-xs text-muted uppercase tracking-widest mb-4">Review Your Proposal</p>

        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-[120px_1fr] gap-3 text-sm items-start">
            <span className="text-xs text-muted uppercase tracking-wider pt-0.5">Type</span>
            <span>{typeInfo?.label}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3 text-sm items-start">
            <span className="text-xs text-muted uppercase tracking-wider pt-0.5">Title</span>
            <span className="font-semibold">{form.title}</span>
          </div>
          {solAmount > 0 && (
            <div className="grid grid-cols-[120px_1fr] gap-3 text-sm items-start">
              <span className="text-xs text-muted uppercase tracking-wider pt-0.5">Treasury Ask</span>
              <span className="text-gold font-semibold">{solAmount} SOL</span>
            </div>
          )}
          <div className="grid grid-cols-[120px_1fr] gap-3 text-sm items-start">
            <span className="text-xs text-muted uppercase tracking-wider pt-0.5">Threshold</span>
            <span className="text-muted">
              {thresholds.majority}% majority · {thresholds.quorum}/{TOTAL_NFTS} quorum
              {thresholds.needsFutarchy && " · + futarchy (Phase 4)"}
            </span>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3 text-sm items-start">
            <span className="text-xs text-muted uppercase tracking-wider pt-0.5">Proposer</span>
            <span className="font-mono text-muted text-xs">{short}</span>
          </div>
        </div>

        <div className="border-t border-border pt-4 mb-5">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Description</p>
          <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">{form.description}</p>
        </div>

        {submitError && (
          <p className="text-xs text-red-600 mb-3">{submitError}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleFinalSubmit}
            disabled={submitting}
            className="px-4 py-1.5 bg-gold text-card text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit to Discord"}
          </button>
          <button
            onClick={() => setStage("form")}
            className="px-4 py-1.5 border border-border text-muted text-sm hover:text-foreground transition-colors"
          >
            ← Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setStage("preview"); }}
      className="bg-card border border-border p-5 space-y-4"
    >
      <h3 className="font-semibold">Submit a Proposal</h3>

      {commonerCount === 0 && (
        <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-300 px-3 py-2">
          You need at least one Commoner NFT to submit a proposal.{" "}
          <a
            href="https://magiceden.io/marketplace/midevilsnft"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View on Magic Eden ↗
          </a>
        </p>
      )}

      <div>
        <label className="block text-xs text-muted mb-1">Proposal type</label>
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          className="w-full bg-black/30 border border-border text-sm px-3 py-2 text-foreground"
        >
          {Object.entries(PROPOSAL_TYPES).map(([key, info]) => (
            <option key={key} value={key}>
              {info.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted mt-1">{typeInfo?.description}</p>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Title</label>
        <input
          type="text"
          required
          maxLength={120}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Short, specific proposal title"
          className="w-full bg-black/30 border border-border text-sm px-3 py-2 text-foreground placeholder:text-muted/50"
        />
      </div>

      {typeInfo?.treasury && (
        <div>
          <label className="block text-xs text-muted mb-1">
            Treasury request (SOL)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.treasurySol}
            onChange={(e) => set("treasurySol", e.target.value)}
            placeholder="0.00"
            className="w-full bg-black/30 border border-border text-sm px-3 py-2 text-foreground placeholder:text-muted/50"
          />
          {solAmount > 0 && (
            <p className="text-xs mt-1">
              {solAmount > 20 ? (
                <span className="text-blue-700">
                  Requires 75% supermajority + futarchy market (Phase 4)
                </span>
              ) : solAmount >= 5 ? (
                <span className="text-gold">
                  Requires 67% supermajority, 36/120 quorum
                </span>
              ) : (
                <span className="text-muted">
                  Standard 51% majority, 24/120 quorum
                </span>
              )}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs text-muted mb-1">Description</label>
        <textarea
          required
          rows={5}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe the proposal, why it matters, and what success looks like."
          className="w-full bg-black/30 border border-border text-sm px-3 py-2 text-foreground placeholder:text-muted/50 resize-y"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!form.title.trim() || !form.description.trim() || commonerCount === 0}
          className="px-4 py-1.5 bg-gold text-card text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 border border-border text-muted text-sm hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function GovernancePage() {
  const { connected, publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [commonerCount, setCommonerCount] = useState(0);
  const [checkingHolder, setCheckingHolder] = useState(false);
  const [govVotes, setGovVotes] = useState({}); // { [proposalId]: { tallies, voters } }
  const [voting, setVoting] = useState(null); // proposalId currently being voted on
  const [voteErrors, setVoteErrors] = useState({}); // { [proposalId]: string }
  const [showForm, setShowForm] = useState(false);

  async function fetchGovVotes() {
    try {
      const res = await fetch("/api/governance-vote");
      if (res.ok) setGovVotes(await res.json());
    } catch {}
  }

  useEffect(() => {
    fetchGovVotes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Verify Commoner holder status whenever wallet changes
  useEffect(() => {
    if (!walletAddress) {
      setCommonerCount(0);
      return;
    }
    setCheckingHolder(true);
    getCommonerCount(walletAddress).then((n) => {
      setCommonerCount(n);
      setCheckingHolder(false);
    });
  }, [walletAddress]);

  const handleVote = useCallback(
    async (proposalId, choice) => {
      if (!walletAddress) return;
      setVoting(proposalId);
      setVoteErrors((e) => ({ ...e, [proposalId]: "" }));
      try {
        const res = await fetch("/api/governance-vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalId, choice, walletAddress }),
        });
        const json = await res.json();
        if (json.ok) {
          await fetchGovVotes();
        } else {
          setVoteErrors((e) => ({
            ...e,
            [proposalId]: json.error || "Vote failed.",
          }));
        }
      } catch {
        setVoteErrors((e) => ({
          ...e,
          [proposalId]: "Network error.",
        }));
      } finally {
        setVoting(null);
      }
    },
    [walletAddress] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  const activeProposals = proposalsData.filter((p) => p.status === "active");
  const pastProposals = proposalsData.filter((p) => p.status !== "active");

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="font-blackletter text-3xl text-gold shrink-0">
          Governance
        </h1>
        <WalletMultiButton
          style={{
            backgroundColor: connected ? "transparent" : "#1a1a1a",
            border: connected ? "1px solid #1a1a1a" : "none",
            color: connected ? "#1a1a1a" : "#f5f5f5",
            fontSize: "0.875rem",
            fontWeight: 600,
            borderRadius: 0,
            height: "auto",
            padding: "0.5rem 1rem",
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Wallet + holder status */}
      {connected && (
        <div
          className={`mb-6 px-4 py-3 text-sm flex items-center justify-between gap-4 ${
            checkingHolder
              ? "bg-border/20 border border-border text-muted"
              : commonerCount > 0
              ? "bg-green-50 border border-green-300 text-green-700"
              : "bg-yellow-50 border border-yellow-300 text-yellow-700"
          }`}
        >
          <span>
            {checkingHolder
              ? "Checking Commoner NFT holdings…"
              : commonerCount > 0
              ? `Commoner holder — ${commonerCount} NFT${commonerCount > 1 ? "s" : ""}, ${commonerCount} vote${commonerCount > 1 ? "s" : ""}`
              : "No Commoner NFTs found — voting restricted to Commoner holders"}
          </span>
          <span className="font-mono text-xs opacity-70">{shortAddress}</span>
        </div>
      )}

      {/* Governance rules summary */}
      <div className="mb-8 bg-card border border-border p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-blackletter text-gold">Voting Rules</h2>
          <a
            href="https://github.com/commiegod/commoners-web/blob/main/GOVERNANCE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted hover:text-gold transition-colors"
          >
            Governance Doc v1.2 ↗
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-muted">
          <div><span className="text-foreground">Eligibility</span> — Hold ≥1 Commoner NFT</div>
          <div><span className="text-foreground">Voting power</span> — 1 vote per NFT held</div>
          <div><span className="text-foreground">Standard majority</span> — 51% yes, 24/120 quorum</div>
          <div><span className="text-foreground">Treasury 5–20 SOL</span> — 67% yes, 36/120 quorum</div>
          <div><span className="text-foreground">Treasury &gt;20 SOL</span> — 75% + futarchy (Phase 4)</div>
          <div><span className="text-foreground">Voting window</span> — 72 hours per proposal</div>
          <div><span className="text-foreground">Emergency freeze</span> — 12 NFTs can pause treasury</div>
          <div><span className="text-foreground">Spending cap</span> — 20 SOL / 30 days at launch</div>
        </div>
      </div>

      {/* How It Works */}
      <div className="mb-8 bg-card border border-border p-4">
        <h2 className="font-blackletter text-gold mb-3">How It Works</h2>
        <ol className="space-y-2 text-sm text-muted">
          <li>
            <span className="text-foreground font-medium">1. Draft your proposal</span> — choose a type, write a title and description, and note any treasury ask.
          </li>
          <li>
            <span className="text-foreground font-medium">2. Submit below</span> — your proposal is sent to <span className="text-foreground">#governance</span> on Discord for community discussion.
          </li>
          <li>
            <span className="text-foreground font-medium">3. Community votes for 72 hours</span> — if it meets the required threshold and quorum, it enters the execution queue.
          </li>
        </ol>
      </div>

      {/* Submit proposal */}
      {connected && !showForm && (
        <div className="mb-6">
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-gold/10 border border-gold/30 text-gold text-sm hover:bg-gold/20 transition-colors"
          >
            + Submit a Proposal
          </button>
          {!connected && (
            <p className="text-xs text-muted mt-2">
              Connect your wallet to submit a proposal.
            </p>
          )}
        </div>
      )}

      {!connected && (
        <div className="mb-6">
          <p className="text-sm text-muted">
            Connect your wallet to submit a proposal or vote.
          </p>
        </div>
      )}

      {showForm && (
        <div className="mb-8">
          <SubmitForm
            onClose={() => setShowForm(false)}
            walletAddress={walletAddress}
            commonerCount={commonerCount}
          />
        </div>
      )}

      {/* Active proposals */}
      <section className="mb-10">
        <h2 className="font-blackletter text-xl text-gold mb-4">
          Active Proposals
        </h2>
        {activeProposals.length === 0 ? (
          <div className="bg-card border border-border p-6 text-center text-muted">
            <p>No active proposals yet.</p>
            <p className="text-xs mt-2">
              Connect your wallet and hold a Commoner NFT to be the first to submit.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeProposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                walletAddress={walletAddress}
                commonerCount={commonerCount}
                onVote={handleVote}
                myVote={govVotes[p.id]?.voters[walletAddress]?.choice ?? null}
                voteError={voteErrors[p.id]}
                voting={voting}
                realVotes={govVotes[p.id]?.tallies}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past proposals */}
      {pastProposals.length > 0 && (
        <section>
          <h2 className="font-blackletter text-xl text-gold mb-4">
            Past Proposals
          </h2>
          <div className="space-y-4">
            {pastProposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                walletAddress={walletAddress}
                commonerCount={commonerCount}
                onVote={handleVote}
                myVote={govVotes[p.id]?.voters[walletAddress]?.choice ?? null}
                voteError={voteErrors[p.id]}
                voting={voting}
                realVotes={govVotes[p.id]?.tallies}
              />
            ))}
          </div>
        </section>
      )}

      {/* Phase 4 notice */}
      <div className="mt-10 bg-blue-50 border border-blue-200 p-4 text-xs text-muted space-y-1">
        <p className="text-blue-700 font-medium">Phase 4 — On-chain Governance</p>
        <p>
          Votes are currently recorded off-chain (shared and persistent, but not
          on-chain). Phase 4 deploys the on-chain treasury program and integrates
          MetaDAO futarchy markets for autonomous proposal execution. Treasury funds
          remain unreleased until Phase 4 is live and audited.
        </p>
      </div>
    </div>
  );
}
