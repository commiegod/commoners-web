"use client";

import { useState } from "react";

const PROPOSALS = [
  {
    id: 1,
    title: "Increase auction fee to 5%",
    description:
      "Raise the SubDAO treasury fee on each auction sale from 3% to 5% to accelerate treasury growth during the bootstrapping period.",
    status: "active",
    proposedBy: "Topoz...axV",
    endsAt: "2026-02-25",
    votes: { yes: 14, no: 3, abstain: 1 },
  },
  {
    id: 2,
    title: "Commission 3 artists for March bounties",
    description:
      "Allocate 1.5 SOL from the treasury to commission three human artists to create bounty artwork for the first week of March auctions.",
    status: "passed",
    proposedBy: "8xRk...9pQm",
    endsAt: "2026-02-10",
    votes: { yes: 22, no: 4, abstain: 2 },
  },
  {
    id: 3,
    title: "Require 100 COMMON to list an auction",
    description:
      "Set a minimum COMMON token balance of 100 as a requirement for any wallet to list a MidEvil in the daily auction.",
    status: "failed",
    proposedBy: "DkLp...7wNr",
    endsAt: "2026-02-01",
    votes: { yes: 8, no: 19, abstain: 0 },
  },
];

const STATUS_STYLES = {
  active: "bg-gold/10 text-gold border border-gold/30",
  passed: "bg-green-500/10 text-green-400 border border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border border-red-500/20",
};

function VoteBar({ votes }) {
  const total = votes.yes + votes.no + votes.abstain;
  if (total === 0) return null;
  const yesPct = Math.round((votes.yes / total) * 100);
  const noPct = Math.round((votes.no / total) * 100);

  return (
    <div className="mt-4">
      <div className="flex h-2 overflow-hidden bg-border rounded-full">
        <div className="bg-green-500 transition-all" style={{ width: `${yesPct}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${noPct}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-muted">
        <span className="text-green-400">{votes.yes} Yes ({yesPct}%)</span>
        <span>{votes.abstain} Abstain</span>
        <span className="text-red-400">{votes.no} No ({noPct}%)</span>
      </div>
    </div>
  );
}

function WalletConnect({ connected, address, onConnect, onDisconnect }) {
  if (connected) {
    return (
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className="text-xs text-muted font-mono">{address}</span>
        <button
          onClick={onDisconnect}
          className="px-3 py-1.5 text-xs border border-border text-muted hover:text-foreground transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      className="px-4 py-2 bg-gold text-background text-sm font-semibold hover:bg-gold/90 transition-colors shrink-0"
    >
      Connect Wallet
    </button>
  );
}

export default function GovernancePage() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [isHolder, setIsHolder] = useState(false);
  const [voted, setVoted] = useState({});

  function handleConnect() {
    // Placeholder — will integrate @solana/wallet-adapter-react
    // and verify Commoner holdings via Helius RPC
    setConnected(true);
    setAddress("Topoz...axV");
    setIsHolder(true);
  }

  function handleDisconnect() {
    setConnected(false);
    setAddress(null);
    setIsHolder(false);
    setVoted({});
  }

  function handleVote(proposalId, choice) {
    setVoted((v) => ({ ...v, [proposalId]: choice }));
  }

  const activeProposals = PROPOSALS.filter((p) => p.status === "active");
  const pastProposals = PROPOSALS.filter((p) => p.status !== "active");

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="font-blackletter text-3xl text-gold shrink-0">Governance</h1>
        <WalletConnect
          connected={connected}
          address={address}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      </div>

      {/* Holder status */}
      {connected && (
        <div
          className={`mb-8 px-4 py-3 text-sm ${
            isHolder
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {isHolder
            ? "Commoner holder verified — you may vote on active proposals."
            : "No Commoner NFTs found in this wallet. Voting requires a Commoner."}
        </div>
      )}

      {/* Active proposals */}
      <section className="mb-10">
        <h2 className="font-blackletter text-xl text-gold mb-4">Active Proposals</h2>
        {activeProposals.length === 0 ? (
          <div className="bg-card border border-border p-6 text-center text-muted">
            No active proposals.
          </div>
        ) : (
          <div className="space-y-4">
            {activeProposals.map((p) => (
              <div key={p.id} className="bg-card border border-border p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="font-semibold">{p.title}</h3>
                  <span className={`text-xs px-2 py-0.5 shrink-0 ${STATUS_STYLES[p.status]}`}>
                    {p.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-muted mb-1">{p.description}</p>
                <p className="text-xs text-muted">
                  Proposed by {p.proposedBy} &middot; Ends {p.endsAt}
                </p>
                <VoteBar votes={p.votes} />

                {connected && isHolder && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {voted[p.id] ? (
                      <p className="text-sm text-gold">
                        You voted: {voted[p.id].toUpperCase()}
                      </p>
                    ) : (
                      <>
                        <button
                          onClick={() => handleVote(p.id, "yes")}
                          className="px-4 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 text-sm hover:bg-green-500/20 transition-colors"
                        >
                          Vote Yes
                        </button>
                        <button
                          onClick={() => handleVote(p.id, "no")}
                          className="px-4 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
                        >
                          Vote No
                        </button>
                        <button
                          onClick={() => handleVote(p.id, "abstain")}
                          className="px-4 py-1.5 bg-card border border-border text-muted text-sm hover:text-foreground transition-colors"
                        >
                          Abstain
                        </button>
                      </>
                    )}
                  </div>
                )}

                {!connected && (
                  <p className="mt-4 text-xs text-muted">
                    Connect a Commoner wallet to vote.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past proposals */}
      <section>
        <h2 className="font-blackletter text-xl text-gold mb-4">Past Proposals</h2>
        <div className="space-y-4">
          {pastProposals.map((p) => (
            <div key={p.id} className="bg-card border border-border p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="font-semibold">{p.title}</h3>
                <span className={`text-xs px-2 py-0.5 shrink-0 ${STATUS_STYLES[p.status]}`}>
                  {p.status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-muted mb-1">{p.description}</p>
              <p className="text-xs text-muted">
                Proposed by {p.proposedBy} &middot; Ended {p.endsAt}
              </p>
              <VoteBar votes={p.votes} />
            </div>
          ))}
        </div>
      </section>

      <p className="mt-10 text-xs text-muted text-center">
        On-chain vote recording and wallet verification via Helius RPC coming in Phase 2.
      </p>
    </div>
  );
}
