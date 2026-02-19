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
  passed: "bg-green-500/10 text-green-400 border border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border border-red-500/20",
  queued: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
};

const VOTE_STORAGE_KEY = "governance_votes_v1";

// ── helpers ───────────────────────────────────────────────────────────────────

function loadVotes() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(VOTE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveVote(proposalId, wallet, choice) {
  const votes = loadVotes();
  votes[`${wallet}:${proposalId}`] = choice;
  localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(votes));
}

function getMyVote(proposalId, wallet) {
  if (!wallet) return null;
  return loadVotes()[`${wallet}:${proposalId}`] ?? null;
}

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
      {/* Vote bar */}
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
          {/* Threshold line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-gold/60"
            style={{ left: `${thresholds.majority}%` }}
            title={`${thresholds.majority}% threshold`}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-muted">
          <span className="text-green-400">
            {votes.yes} Yes ({yesPct}%)
          </span>
          <span>{votes.abstain} Abstain</span>
          <span className="text-red-400">
            {votes.no} No ({noPct}%)
          </span>
        </div>
      </div>

      {/* Quorum + threshold status */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={quorumMet ? "text-green-400" : "text-muted"}>
          Quorum: {total}/{thresholds.quorum} NFTs ({quorumPct}%){" "}
          {quorumMet ? "✓" : `— need ${thresholds.quorum - total} more`}
        </span>
        <span className={majorityMet && quorumMet ? "text-green-400" : "text-muted"}>
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
        <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400">
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

function ProposalCard({ proposal, walletAddress, commonerCount, onVote, myVote }) {
  const thresholds = getThresholds(proposal.type, proposal.treasurySol);
  const typeInfo = PROPOSAL_TYPES[proposal.type];
  const isActive = proposal.status === "active";
  const timeLeft = isActive ? formatTimeLeft(proposal.endsAt) : null;
  const expired = isActive && msRemaining(proposal.endsAt) === 0;

  const canVote =
    isActive &&
    !expired &&
    !!walletAddress &&
    commonerCount > 0 &&
    !myVote;

  return (
    <div className="bg-card border border-border p-4 sm:p-5">
      {/* Header */}
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

      {/* Type + thresholds */}
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
        Proposed by {proposal.proposedBy} &middot;{" "}
        {isActive ? "Ends" : "Ended"}{" "}
        {new Date(proposal.endsAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      <VoteBar votes={proposal.votes} thresholds={thresholds} />

      {/* Voting controls */}
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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onVote(proposal.id, "yes")}
                className="px-4 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 text-sm hover:bg-green-500/20 transition-colors"
              >
                Vote Yes
              </button>
              <button
                onClick={() => onVote(proposal.id, "no")}
                className="px-4 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
              >
                Vote No
              </button>
              <button
                onClick={() => onVote(proposal.id, "abstain")}
                className="px-4 py-1.5 bg-card border border-border text-muted text-sm hover:text-foreground transition-colors"
              >
                Abstain
              </button>
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

function SubmitForm({ onClose, walletAddress }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  const typeInfo = PROPOSAL_TYPES[form.type];
  const solAmount = parseFloat(form.treasurySol) || 0;
  const thresholds = getThresholds(form.type, solAmount);

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
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

  if (submitted) {
    return (
      <div className="bg-card border border-border p-5">
        <h3 className="font-semibold mb-3">Proposal Ready to Submit</h3>
        <p className="text-sm text-muted mb-4">
          Copy the text below and post it in{" "}
          <span className="text-gold">#governance</span> on Discord. An admin
          will add it to the on-chain queue after community review. On-chain
          autonomous submission arrives in Phase 4.
        </p>
        <pre className="text-xs bg-black/30 border border-border p-3 overflow-x-auto whitespace-pre-wrap font-mono text-muted">
          {markdownPreview}
        </pre>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => navigator.clipboard?.writeText(markdownPreview)}
            className="px-4 py-1.5 bg-gold text-black text-sm font-semibold hover:bg-gold/90 transition-colors"
          >
            Copy
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-border text-muted text-sm hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border p-5 space-y-4"
    >
      <h3 className="font-semibold">Submit a Proposal</h3>

      {/* Type */}
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

      {/* Title */}
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

      {/* Treasury amount (treasury proposals only) */}
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
                <span className="text-blue-400">
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

      {/* Description */}
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
          disabled={!form.title.trim() || !form.description.trim()}
          className="px-4 py-1.5 bg-gold text-black text-sm font-semibold hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
  const [votes, setVotes] = useState({});
  const [showForm, setShowForm] = useState(false);

  // Load persisted votes on mount
  useEffect(() => {
    setVotes(loadVotes());
  }, []);

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
    (proposalId, choice) => {
      if (!walletAddress) return;
      saveVote(proposalId, walletAddress, choice);
      setVotes(loadVotes());
    },
    [walletAddress]
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
            backgroundColor: connected ? "transparent" : "#d4a843",
            border: connected ? "1px solid #d4a843" : "none",
            color: connected ? "#d4a843" : "#09090b",
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
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
          }`}
        >
          <span>
            {checkingHolder
              ? "Checking Commoner NFT holdings…"
              : commonerCount > 0
              ? `Commoner holder — ${commonerCount} NFT${commonerCount > 1 ? "s" : ""}, ${commonerCount} vote${commonerCount > 1 ? "s" : ""}`
              : "No Commoner NFTs found — voting restricted"}
          </span>
          <span className="font-mono text-xs opacity-70">{shortAddress}</span>
        </div>
      )}

      {/* Governance rules summary */}
      <div className="mb-8 bg-card border border-border p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-blackletter text-gold">Voting Rules</h2>
          <a
            href="/docs/governance-v1.2.md"
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

      {/* Submit proposal */}
      {connected && commonerCount > 0 && !showForm && (
        <div className="mb-6">
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-gold/10 border border-gold/30 text-gold text-sm hover:bg-gold/20 transition-colors"
          >
            + Submit a Proposal
          </button>
        </div>
      )}

      {showForm && (
        <div className="mb-8">
          <SubmitForm
            onClose={() => setShowForm(false)}
            walletAddress={walletAddress}
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
            No active proposals.
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
                myVote={getMyVote(p.id, walletAddress)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past proposals */}
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
              myVote={getMyVote(p.id, walletAddress)}
            />
          ))}
        </div>
      </section>

      {/* Phase 4 notice */}
      <div className="mt-10 bg-blue-500/5 border border-blue-500/15 p-4 text-xs text-muted space-y-1">
        <p className="text-blue-400 font-medium">Phase 4 — On-chain Governance</p>
        <p>
          Votes are currently stored locally and counted off-chain. Phase 4 deploys
          the on-chain treasury program and integrates MetaDAO futarchy markets for
          autonomous proposal execution. Treasury funds remain unreleased until
          Phase 4 is live and audited.
        </p>
      </div>
    </div>
  );
}
