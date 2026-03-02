"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import dynamic from "next/dynamic";
import { Buffer } from "buffer";
import {
  getCommonerCount,
  getThresholds,
  formatTimeLeft,
  msRemaining,
  PROPOSAL_TYPES,
  TOTAL_NFTS,
} from "../../../lib/commoners";
import {
  getConnection,
  fetchProposalAccount,
  fetchVoteRecord,
  RPC_URL,
} from "../../../lib/programClient";

const IS_DEVNET = !RPC_URL.includes("mainnet");

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
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function VoteBar({ forV, against, abstain, thresholds }) {
  const total = forV + against + abstain;
  if (total === 0) return null;
  const forPct = Math.round((forV / total) * 100);
  const againstPct = Math.round((against / total) * 100);
  const quorumMet = total >= thresholds.quorum;
  return (
    <div className="mt-3">
      <div className="flex h-1.5 overflow-hidden bg-border">
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
  const { id } = use(params);

  // ── Proposal data (fetched at runtime from GitHub via API) ─────────────────
  const [proposal, setProposal] = useState(null);
  const [propLoading, setPropLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/proposals/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setPropLoading(false); return null; }
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data) { setProposal(data); setPropLoading(false); }
      })
      .catch(() => { setNotFound(true); setPropLoading(false); });
  }, [id]);

  // ── Wallet ─────────────────────────────────────────────────────────────────
  const { connected, publicKey, sendTransaction, signTransaction } = useWallet();
  const { connection: walletConnection } = useConnection();
  const walletAddress = publicKey?.toBase58() ?? null;

  const hasChain = !!proposal?.chainId;

  const [commonerCount, setCommonerCount] = useState(0);
  const [checkingHolder, setCheckingHolder] = useState(false);

  // On-chain state
  const [chainTallies, setChainTallies] = useState(null);
  const [chainVoted, setChainVoted] = useState(false);
  const [chainVoteRecord, setChainVoteRecord] = useState(null);

  // Off-chain state (legacy / fallback)
  const [govVotes, setGovVotes] = useState(null);

  const [alloc, setAlloc] = useState({ yes: 0, no: 0, abstain: 0 });
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [txSig, setTxSig] = useState("");

  // ── Fetch tallies ──────────────────────────────────────────────────────────

  const fetchChainTallies = useCallback(async () => {
    if (!hasChain || !proposal?.chainId) return;
    try {
      const conn = getConnection();
      const result = await fetchProposalAccount(conn, BigInt(proposal.chainId));
      if (result) {
        const { state } = result;
        setChainTallies({
          yes: state.yes.toNumber(),
          no: state.no.toNumber(),
          abstain: state.abstain.toNumber(),
        });
      }
    } catch {}
  }, [hasChain, proposal?.chainId]);

  const fetchChainVoteRecord = useCallback(async () => {
    if (!hasChain || !publicKey || !proposal?.chainId) return;
    try {
      const conn = getConnection();
      const record = await fetchVoteRecord(conn, BigInt(proposal.chainId), publicKey);
      setChainVoted(!!record);
      setChainVoteRecord(record?.state ?? null);
    } catch {}
  }, [hasChain, proposal?.chainId, publicKey]);

  async function fetchOffChainVotes() {
    try {
      const res = await fetch("/api/governance-vote");
      if (res.ok) {
        const all = await res.json();
        setGovVotes(all[id] ?? { tallies: { yes: 0, no: 0, abstain: 0 }, voters: {} });
      }
    } catch {}
  }

  useEffect(() => {
    if (!proposal) return;
    if (hasChain) fetchChainTallies();
    else fetchOffChainVotes();
  }, [hasChain, proposal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasChain) fetchChainVoteRecord();
  }, [fetchChainVoteRecord]);

  useEffect(() => {
    if (!walletAddress) { setCommonerCount(0); return; }
    setCheckingHolder(true);
    getCommonerCount(walletAddress).then((n) => {
      setCommonerCount(n);
      setCheckingHolder(false);
    });
  }, [walletAddress]);

  // ── Vote handlers ──────────────────────────────────────────────────────────

  const handleChainVote = useCallback(async () => {
    if (!walletAddress || !publicKey || !signTransaction) return;
    setVoting(true);
    setVoteError("");
    setTxSig("");
    let submittedSig = null;
    try {
      const res = await fetch("/api/governance-vote-prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.chainId,
          walletAddress,
          yes: alloc.yes,
          no: alloc.no,
          abstain: alloc.abstain,
        }),
      });
      const json = await res.json();
      if (!json.ok) { setVoteError(json.error || "Vote preparation failed."); return; }

      const tx = Transaction.from(Buffer.from(json.transaction, "base64"));

      // Sign with the wallet, then submit via our own connection (walletConnection
      // is set from our ConnectionProvider → RPC_URL). This avoids the case where
      // some wallet adapters use their own RPC endpoint for sendTransaction.
      let signed;
      try {
        signed = await signTransaction(tx);
      } catch (walletErr) {
        setVoteError("Wallet rejected: " + (walletErr.message || "User denied signature"));
        return;
      }

      let sig;
      try {
        sig = await walletConnection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });
      } catch (sendErr) {
        // Capture Anchor/program simulation logs if available
        const logs = sendErr.logs ?? [];
        const programLog = logs.find(
          (l) => l.includes("Error") || l.includes("error") || l.includes("custom program error")
        );
        setVoteError(
          programLog
            ? `Program error: ${programLog}`
            : sendErr.message || "Transaction rejected by network"
        );
        return;
      }

      submittedSig = sig;
      setTxSig(sig);
      try {
        await walletConnection.confirmTransaction(
          { signature: sig, blockhash: json.blockhash, lastValidBlockHeight: json.lastValidBlockHeight },
          "confirmed"
        );
        setAlloc({ yes: 0, no: 0, abstain: 0 });
        await fetchChainTallies();
        await fetchChainVoteRecord();
      } catch (confirmErr) {
        const isTimeout =
          confirmErr.name === "TransactionExpiredBlockheightExceededError" ||
          confirmErr.message?.includes("block height exceeded") ||
          confirmErr.message?.includes("was not confirmed");
        if (isTimeout) {
          setVoteError("Confirmation timed out — your vote likely landed. Check Solscan to verify.");
        } else {
          throw confirmErr;
        }
      }
    } catch (err) {
      if (!submittedSig) setVoteError(err.message || "Transaction failed.");
      else setVoteError(err.message || "Unexpected error after submission.");
    } finally {
      setVoting(false);
    }
  }, [walletAddress, publicKey, alloc, proposal?.chainId, signTransaction, walletConnection, fetchChainTallies, fetchChainVoteRecord]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOffChainVote = useCallback(async () => {
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
        await fetchOffChainVotes();
        setAlloc({ yes: 0, no: 0, abstain: 0 });
      } else {
        setVoteError(json.error || "Vote failed.");
      }
    } catch { setVoteError("Network error."); }
    finally { setVoting(false); }
  }, [walletAddress, alloc, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading / not found ────────────────────────────────────────────────────

  if (propLoading) {
    return (
      <div className="max-w-4xl">
        <Link href="/governance" className="text-sm text-muted hover:text-foreground transition-colors">
          ← Governance
        </Link>
        <p className="mt-8 text-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (notFound || !proposal) {
    return (
      <div className="max-w-4xl">
        <Link href="/governance" className="text-sm text-muted hover:text-foreground transition-colors">
          ← Governance
        </Link>
        <p className="mt-8 text-muted">Proposal not found.</p>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const typeInfo = PROPOSAL_TYPES[proposal.type];
  const thresholds = getThresholds(proposal.type, proposal.treasurySol);
  const isActive = proposal.status === "active";
  const expired = isActive && msRemaining(proposal.endsAt) === 0;
  const timeLeft = isActive ? formatTimeLeft(proposal.endsAt) : null;

  const tallies = hasChain
    ? (chainTallies ?? proposal.votes ?? { yes: 0, no: 0, abstain: 0 })
    : (govVotes?.tallies ?? proposal.votes ?? { yes: 0, no: 0, abstain: 0 });

  const forVotes = tallies.yes ?? 0;
  const againstVotes = tallies.no ?? 0;
  const abstainVotes = tallies.abstain ?? 0;

  const myVote = hasChain
    ? (chainVoted ? chainVoteRecord : null)
    : (govVotes?.voters?.[walletAddress] ?? null);
  const hasVoted = hasChain ? chainVoted : !!myVote;
  const allocTotal = alloc.yes + alloc.no + alloc.abstain;
  const handleVote = hasChain ? handleChainVote : handleOffChainVote;
  const cluster = IS_DEVNET ? "?cluster=devnet" : "";

  return (
    <div className="max-w-4xl">
      {/* ── Back + status ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link href="/governance" className="text-sm text-muted hover:text-foreground transition-colors">
          ← Governance
        </Link>
        <span className="text-border">·</span>
        <span className="text-sm text-muted font-mono">
          Proposal #{proposal.proposalNumber ?? "—"}
        </span>
        <span
          className={`text-xs px-2 py-0.5 font-medium capitalize ${STATUS_STYLES[proposal.status] ?? STATUS_STYLES.pending}`}
        >
          {proposal.status}
        </span>
        {hasChain && (
          <span className="text-xs text-muted border border-border px-2 py-0.5">On-chain ✓</span>
        )}
      </div>

      {/* ── Title + meta ── */}
      <h1 className="font-blackletter text-3xl text-foreground leading-tight mb-3">
        {proposal.title}
      </h1>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mb-8">
        <span>
          Proposed by{" "}
          <span className="font-mono text-xs" title={proposal.proposedBy}>
            {shortAddr(proposal.proposedBy)}
          </span>
        </span>
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
          {isActive && timeLeft
            ? timeLeft
            : `Ended ${new Date(proposal.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
        </span>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 border border-border mb-8 text-sm">
        <div className="p-4 border-r border-border">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">Threshold</p>
          <p className="font-medium">{thresholds.majority}% majority</p>
          <p className="text-xs text-muted">{thresholds.quorum} / {TOTAL_NFTS} quorum</p>
        </div>
        <div className="p-4 border-r border-border">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">{isActive ? "Ends" : "Ended"}</p>
          <p className="font-medium">
            {new Date(proposal.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
          {timeLeft && <p className="text-xs text-muted">{timeLeft}</p>}
        </div>
        <div className="p-4">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">Total Votes</p>
          <p className="font-medium">{forVotes + againstVotes + abstainVotes}</p>
          <p className="text-xs text-muted">{thresholds.quorum} needed for quorum</p>
        </div>
      </div>

      {/* ── Main content + sidebar ── */}
      <div className="grid md:grid-cols-[1fr_260px] gap-8">

        {/* ── Description + image ── */}
        <div className="space-y-6">
          {proposal.imageUrl && (
            <img
              src={proposal.imageUrl}
              alt={proposal.title}
              className="w-full max-h-96 object-cover border border-border"
            />
          )}

          <div>
            <h2 className="font-blackletter text-xl text-gold mb-3">Description</h2>
            <div className="text-sm text-muted leading-relaxed whitespace-pre-wrap">
              {proposal.description}
            </div>
          </div>

          {/* Proposed transaction (treasury proposals) */}
          {proposal.treasurySol > 0 && (
            <div>
              <h2 className="font-blackletter text-xl text-gold mb-3">Proposed Transaction</h2>
              <div className="border border-border p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted">Amount</span>
                  <span className="font-medium">{proposal.treasurySol} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Recipient</span>
                  <span className="font-mono text-xs" title={proposal.proposedBy}>
                    {shortAddr(proposal.proposedBy)}
                  </span>
                </div>
                <p className="text-xs text-muted pt-1">
                  Treasury disbursement — executed autonomously after vote passes (Phase 4) or by admin after confirmation (current phase).
                </p>
              </div>
            </div>
          )}

          {/* On-chain links */}
          {(proposal.txSig || proposal.finalizeTxSig) && (
            <div className="text-xs text-muted space-y-1">
              {proposal.txSig && (
                <p>
                  Proposal created:{" "}
                  <a
                    href={`https://solscan.io/tx/${proposal.txSig}${cluster}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-gold hover:underline"
                  >
                    {proposal.txSig.slice(0, 8)}…
                  </a>
                </p>
              )}
              {proposal.finalizeTxSig && (
                <p>
                  Finalized:{" "}
                  <a
                    href={`https://solscan.io/tx/${proposal.finalizeTxSig}${cluster}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-gold hover:underline"
                  >
                    {proposal.finalizeTxSig.slice(0, 8)}…
                  </a>
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Vote sidebar ── */}
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

            <VoteBar forV={forVotes} against={againstVotes} abstain={abstainVotes} thresholds={thresholds} />

            {/* Voting UI */}
            {isActive && !expired && (
              <div className="pt-2">
                {hasVoted ? (
                  <div className="text-sm text-gold">
                    Voted ✓{" "}
                    {hasChain && txSig && (
                      <a
                        href={`https://solscan.io/tx/${txSig}${cluster}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted hover:text-gold font-mono"
                      >
                        view tx ↗
                      </a>
                    )}
                    {chainVoteRecord && (
                      <p className="text-xs text-muted font-normal mt-1">
                        Yes: {chainVoteRecord.yes?.toNumber?.() ?? 0} · No: {chainVoteRecord.no?.toNumber?.() ?? 0} · Abstain: {chainVoteRecord.abstain?.toNumber?.() ?? 0}
                      </p>
                    )}
                    {!hasChain && myVote?.allocations && (
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
                        backgroundColor: "#1a1a1a", color: "#f5f5f5",
                        fontSize: "0.75rem", borderRadius: "9999px", height: "auto",
                        padding: "0.375rem 0.75rem", lineHeight: 1.5,
                        width: "100%", justifyContent: "center",
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
                    {voteError && (
                      <div className="text-xs text-red-600 space-y-1">
                        <p>{voteError}</p>
                        {txSig && (
                          <a
                            href={`https://solscan.io/tx/${txSig}${cluster}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gold hover:underline font-mono block"
                          >
                            View transaction on Solscan ↗
                          </a>
                        )}
                      </div>
                    )}
                    <button
                      onClick={handleVote}
                      disabled={voting || allocTotal === 0}
                      className="w-full px-4 py-2 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
                    >
                      {voting ? "Submitting…" : `Submit Vote${hasChain ? " (on-chain)" : ""}`}
                    </button>
                    {hasChain && (
                      <p className="text-xs text-muted text-center">Requires wallet signature · ~0.001 SOL</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {expired && <p className="text-xs text-muted pt-2">Voting period has ended.</p>}
            {!isActive && <p className="text-xs text-muted pt-2 capitalize">This proposal {proposal.status}.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
