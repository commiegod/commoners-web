"use client";

import { useState, useEffect, useCallback } from "react";
import { getThresholds } from "../../lib/commoners";

// ── Bounty submission card ────────────────────────────────────────────────────

function SubmissionCard({ sub, token, onDone }) {
  const [status, setStatus] = useState(null);

  async function act(endpoint) {
    setStatus(endpoint === "approve" ? "approving" : "rejecting");
    try {
      const res = await fetch(`/api/admin/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: sub.id }),
      });
      const data = await res.json();
      if (data.ok) {
        onDone(sub.id);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const date = new Date(sub.submittedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="bg-card border border-border p-4 flex gap-4">
      <a href={sub.imageUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
        <img
          src={sub.imageUrl}
          alt={sub.artistName}
          className="w-28 h-28 object-cover border border-border hover:opacity-90 transition-opacity"
        />
      </a>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">{sub.artistName}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-xs border border-border px-1.5 py-0.5 text-muted">
                {sub.type}
              </span>
              <span className="text-xs text-muted">Auction date: {sub.date}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {status === "error" ? (
              <span className="text-xs text-red-600 self-center">Error — try again</span>
            ) : (
              <>
                <button
                  onClick={() => act("approve")}
                  disabled={!!status}
                  className="px-3 py-1.5 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {status === "approving" ? "…" : "Approve"}
                </button>
                <button
                  onClick={() => act("reject")}
                  disabled={!!status}
                  className="px-3 py-1.5 border border-border text-muted text-sm hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  {status === "rejecting" ? "…" : "Reject"}
                </button>
              </>
            )}
          </div>
        </div>
        <p className="text-xs font-mono text-muted break-all">{sub.solanaAddress}</p>
        {(sub.twitter || sub.instagram || sub.website) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            {sub.twitter && (
              <a
                href={`https://twitter.com/${sub.twitter.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                X: {sub.twitter}
              </a>
            )}
            {sub.instagram && (
              <a
                href={`https://instagram.com/${sub.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                IG: {sub.instagram}
              </a>
            )}
            {sub.website && (
              <a
                href={sub.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {sub.website}
              </a>
            )}
          </div>
        )}
        <p className="text-xs text-muted">Submitted {date}</p>
      </div>
    </div>
  );
}

// ── Governance proposal card ──────────────────────────────────────────────────

function ProposalCard({ prop, token, onDone }) {
  const [status, setStatus] = useState(null);

  async function act(endpoint) {
    setStatus(endpoint === "approve-proposal" ? "approving" : "rejecting");
    try {
      const res = await fetch(`/api/admin/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: prop.id }),
      });
      const data = await res.json();
      if (data.ok) {
        onDone(prop.id);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const date = new Date(prop.submittedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const short = prop.proposedBy
    ? `${prop.proposedBy.slice(0, 4)}…${prop.proposedBy.slice(-4)}`
    : "";

  return (
    <div className="bg-card border border-border p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{prop.title}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="text-xs border border-border px-1.5 py-0.5 text-muted">
              {prop.type}
            </span>
            {prop.treasurySol > 0 && (
              <span className="text-xs text-gold px-1.5 py-0.5 border border-gold/30">
                {prop.treasurySol} SOL
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {status === "error" ? (
            <span className="text-xs text-red-600 self-center">Error — try again</span>
          ) : (
            <>
              <button
                onClick={() => act("approve-proposal")}
                disabled={!!status}
                className="px-3 py-1.5 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {status === "approving" ? "…" : "Approve"}
              </button>
              <button
                onClick={() => act("reject-proposal")}
                disabled={!!status}
                className="px-3 py-1.5 border border-border text-muted text-sm hover:text-foreground disabled:opacity-40 transition-colors"
              >
                {status === "rejecting" ? "…" : "Reject"}
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-muted">{prop.description}</p>
      <p className="text-xs text-muted font-mono">
        Proposer: {short} · Submitted {date}
      </p>
    </div>
  );
}

// ── Finalize proposal card ────────────────────────────────────────────────────

function FinalizeCard({ prop, token, onDone }) {
  const [confirming, setConfirming] = useState(null); // null | 1 | 2 | 3
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const yes = prop.votes?.yes ?? 0;
  const no = prop.votes?.no ?? 0;
  const abstain = prop.votes?.abstain ?? 0;
  const total = yes + no + abstain;

  const thresholds = getThresholds(prop.type, prop.treasurySol);
  const quorumMet = total >= thresholds.quorum;
  const majorityPassed = yes > no && (yes / Math.max(total, 1)) * 100 >= thresholds.majority;
  const hasTreasuryAsk = (prop.treasurySol ?? 0) > 0;

  // Auto-determine outcome from votes
  const autoStatus = quorumMet && majorityPassed ? 1 : 2; // 1=passed, 2=failed
  const noVotesCast = total === 0;

  const now = new Date();
  const endsAt = new Date(prop.endsAt);
  const votingOpen = endsAt > now;
  const endLabel = endsAt.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  const STATUS_LABELS = { 1: "Passed", 2: "Failed", 3: "Queued" };
  const STATUS_DESCRIPTIONS = {
    1: "The proposal passed. The outcome will be recorded on-chain and the status updated.",
    2: "The proposal failed — quorum was not met or the majority voted against. No changes will be made.",
    3: "The proposal passed but the treasury disbursement is held in a time-lock queue pending admin execution. Use this only for treasury proposals where you want a delay before funds move.",
  };

  async function finalize(status) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/finalize-proposal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: prop.id, status }),
      });
      const data = await res.json();
      if (data.ok) {
        onDone(prop.id, data.status);
      } else {
        setError(data.error || "Error");
        setBusy(false);
        setConfirming(null);
      }
    } catch {
      setError("Network error");
      setBusy(false);
      setConfirming(null);
    }
  }

  return (
    <div className="bg-card border border-border p-4 space-y-4">
      {/* Header */}
      <div>
        <p className="font-semibold">{prop.title}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          <span className="text-xs border border-border px-1.5 py-0.5 text-muted">{prop.type}</span>
          {hasTreasuryAsk && (
            <span className="text-xs text-gold px-1.5 py-0.5 border border-gold/30">
              {prop.treasurySol} SOL
            </span>
          )}
          {votingOpen ? (
            <span className="text-xs text-amber-600 border border-amber-300 px-1.5 py-0.5">
              Voting open until {endLabel}
            </span>
          ) : (
            <span className="text-xs text-muted">Ended {endLabel}</span>
          )}
        </div>
      </div>

      {/* Vote results */}
      <div className="border border-border p-3 space-y-1 text-sm">
        <div className="flex gap-4">
          <span className="text-green-700 font-medium">{yes} For</span>
          <span className="text-red-600 font-medium">{no} Against</span>
          <span className="text-muted">{abstain} Abstain</span>
        </div>
        {noVotesCast ? (
          <p className="text-xs text-muted">No votes recorded — this proposal has not been voted on.</p>
        ) : (
          <p className="text-xs text-muted">
            {quorumMet ? `Quorum met (${total}/${thresholds.quorum})` : `Quorum not met (${total}/${thresholds.quorum})`}
            {" · "}
            {majorityPassed ? `Majority for (${thresholds.majority}% threshold)` : `Majority against or threshold not reached`}
          </p>
        )}
      </div>

      {/* Determined outcome */}
      {!confirming && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Determined outcome:</span>
            <span className={`text-xs font-semibold px-2 py-0.5 border ${autoStatus === 1 ? "text-green-700 border-green-300 bg-green-50" : "text-red-700 border-red-300 bg-red-50"}`}>
              {STATUS_LABELS[autoStatus]}
            </span>
            {noVotesCast && (
              <span className="text-xs text-amber-600">⚠ No votes cast</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(autoStatus)}
              className="px-4 py-2 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
            >
              Finalize as {STATUS_LABELS[autoStatus]} →
            </button>
            {hasTreasuryAsk && autoStatus === 1 && (
              <button
                onClick={() => setConfirming(3)}
                className="px-4 py-2 border border-border text-muted text-sm hover:text-foreground transition-colors"
                title="Hold disbursement in time-lock queue before funds move"
              >
                Queue instead
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation step */}
      {confirming && (
        <div className="border border-border p-3 space-y-3 bg-background">
          <p className="text-sm font-medium">Confirm: Finalize as {STATUS_LABELS[confirming]}</p>
          <p className="text-xs text-muted">{STATUS_DESCRIPTIONS[confirming]}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => finalize(confirming)}
              disabled={busy}
              className="px-4 py-2 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? "Recording on-chain…" : "Confirm"}
            </button>
            <button
              onClick={() => { setConfirming(null); setError(null); }}
              disabled={busy}
              className="px-4 py-2 border border-border text-muted text-sm hover:text-foreground disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Discussion helpers ────────────────────────────────────────────────────────

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function shortAddr(addr) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

// ── Thread card (admin) ───────────────────────────────────────────────────────

function ThreadCard({ thread, token, onDeleted }) {
  const [confirmThread, setConfirmThread] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);
  const [confirmReply, setConfirmReply] = useState(null); // replyId
  const [deletingReply, setDeletingReply] = useState(null); // replyId
  const [error, setError] = useState(null);

  async function deleteThread() {
    setDeletingThread(true);
    setError(null);
    try {
      const res = await fetch("/api/discussion", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ threadId: thread.id }),
      });
      const data = await res.json();
      if (data.ok) onDeleted(thread.id, null, null);
      else setError(data.error || "Delete failed.");
    } catch {
      setError("Network error.");
    } finally {
      setDeletingThread(false);
      setConfirmThread(false);
    }
  }

  async function deleteReply(replyId) {
    setDeletingReply(replyId);
    setError(null);
    try {
      const res = await fetch("/api/discussion/reply", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ threadId: thread.id, replyId }),
      });
      const data = await res.json();
      if (data.ok) onDeleted(null, thread.id, replyId);
      else setError(data.error || "Delete failed.");
    } catch {
      setError("Network error.");
    } finally {
      setDeletingReply(null);
      setConfirmReply(null);
    }
  }

  return (
    <div className="bg-card border border-border p-4 space-y-3">
      {/* Thread header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{thread.subject}</p>
          <p className="text-xs text-muted font-mono mt-0.5">
            {shortAddr(thread.author)} · {timeAgo(thread.timestamp)} ·{" "}
            {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confirmThread ? (
            <>
              <span className="text-xs text-muted">Delete thread + all replies?</span>
              <button
                onClick={deleteThread}
                disabled={deletingThread}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-full hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                {deletingThread ? "…" : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmThread(false)}
                className="px-3 py-1.5 border border-border text-muted text-xs rounded-full hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmThread(true)}
              className="px-3 py-1.5 border border-red-300 text-red-600 text-xs rounded-full hover:bg-red-50 transition-colors cursor-pointer"
            >
              Delete Thread
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted line-clamp-3 leading-snug">{thread.body}</p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-xs text-muted uppercase tracking-widest">Replies</p>
          {thread.replies.map((reply, i) => (
            <div key={reply.id} className="flex items-start gap-3 pl-3 border-l-2 border-border">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted font-mono mb-1">
                  #{i + 1} · {shortAddr(reply.author)} · {timeAgo(reply.timestamp)}
                </p>
                <p className="text-sm text-foreground line-clamp-3 leading-snug">{reply.body}</p>
              </div>
              <div className="shrink-0 pt-0.5">
                {confirmReply === reply.id ? (
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => deleteReply(reply.id)}
                      disabled={deletingReply === reply.id}
                      className="px-2.5 py-0.5 bg-red-600 text-white text-xs rounded-full hover:opacity-90 disabled:opacity-40 cursor-pointer"
                    >
                      {deletingReply === reply.id ? "…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmReply(null)}
                      className="px-2.5 py-0.5 border border-border text-muted text-xs rounded-full hover:text-foreground cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmReply(reply.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Discussion section ────────────────────────────────────────────────────────

function DiscussionSection({ token }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discussion");
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function onDeleted(threadId, parentThreadId, replyId) {
    if (threadId) {
      setThreads((t) => t.filter((th) => th.id !== threadId));
    } else {
      setThreads((t) =>
        t.map((th) =>
          th.id === parentThreadId
            ? { ...th, replies: th.replies.filter((r) => r.id !== replyId) }
            : th
        )
      );
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-blackletter text-2xl text-gold">
          The Board
          {!loading && (
            <span className="ml-3 text-lg font-sans text-muted font-normal">
              ({threads.length} thread{threads.length !== 1 ? "s" : ""})
            </span>
          )}
        </h2>
        <button
          onClick={load}
          className="text-xs text-muted hover:text-foreground border border-border px-3 py-1.5 rounded-full cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : threads.length === 0 ? (
        <div className="bg-card border border-border p-8 text-center text-muted text-sm">
          No threads yet.
        </div>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              token={token}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin panel ───────────────────────────────────────────────────────────────

export default function AdminPanel({ token }) {
  const [pending, setPending] = useState([]);
  const [pendingProps, setPendingProps] = useState([]);
  const [activeProps, setActiveProps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastApproved, setLastApproved] = useState(null);
  const [lastApprovedProp, setLastApprovedProp] = useState(null);
  const [finalizedProps, setFinalizedProps] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bountyRes, propRes, activeRes] = await Promise.all([
        fetch("/api/admin/pending", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/pending-proposals", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/active-proposals", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!bountyRes.ok) throw new Error(`bounty ${bountyRes.status}`);
      const bountyData = await bountyRes.json();
      setPending(Array.isArray(bountyData) ? bountyData.slice().reverse() : []);
      if (propRes.ok) {
        const propData = await propRes.json();
        setPendingProps(Array.isArray(propData) ? propData.slice().reverse() : []);
      }
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveProps(Array.isArray(activeData) ? activeData : []);
      }
    } catch (e) {
      setError(`Failed to load: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function onBountyDone(id) {
    const sub = pending.find((s) => s.id === id);
    if (sub) setLastApproved(sub);
    setPending((p) => p.filter((s) => s.id !== id));
  }

  function onPropDone(id) {
    const prop = pendingProps.find((p) => p.id === id);
    if (prop) setLastApprovedProp(prop);
    setPendingProps((p) => p.filter((s) => s.id !== id));
  }

  function onFinalized(id, statusLabel) {
    setFinalizedProps((prev) => [...prev, { id, statusLabel }]);
    setActiveProps((p) => p.filter((s) => s.id !== id));
  }

  return (
    <div className="max-w-3xl space-y-16">
      {/* ── Bounty submissions ── */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-blackletter text-3xl text-gold">
            Bounty Submissions
            {!loading && (
              <span className="ml-3 text-lg font-sans text-muted font-normal">
                ({pending.length} pending)
              </span>
            )}
          </h1>
          <button
            onClick={load}
            className="text-xs text-muted hover:text-foreground transition-colors border border-border px-3 py-1.5"
          >
            Refresh
          </button>
        </div>

        {lastApproved && (
          <div className="mb-6 bg-green-50 border border-green-300 text-green-700 text-sm px-4 py-3">
            ✓ Approved <strong>{lastApproved.artistName}</strong> for{" "}
            {lastApproved.date} — Vercel is rebuilding (~30s).
          </div>
        )}

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : pending.length === 0 ? (
          <div className="bg-card border border-border p-8 text-center text-muted text-sm">
            No pending submissions.
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((sub) => (
              <SubmissionCard
                key={sub.id}
                sub={sub}
                token={token}
                onDone={onBountyDone}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Governance proposals ── */}
      <div>
        <h2 className="font-blackletter text-2xl text-gold mb-6">
          Governance Proposals
          {!loading && (
            <span className="ml-3 text-lg font-sans text-muted font-normal">
              ({pendingProps.length} pending)
            </span>
          )}
        </h2>

        {lastApprovedProp && (
          <div className="mb-6 bg-green-50 border border-green-300 text-green-700 text-sm px-4 py-3">
            ✓ Approved <strong>"{lastApprovedProp.title}"</strong> — opens for a
            72-hour vote. Vercel is rebuilding (~30s).
          </div>
        )}

        {!loading && pendingProps.length === 0 ? (
          <div className="bg-card border border-border p-8 text-center text-muted text-sm">
            No pending proposals.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingProps.map((prop) => (
              <ProposalCard
                key={prop.id}
                prop={prop}
                token={token}
                onDone={onPropDone}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Finalize proposals ── */}
      <div>
        <h2 className="font-blackletter text-2xl text-gold mb-6">
          Finalize Proposals
          {!loading && (
            <span className="ml-3 text-lg font-sans text-muted font-normal">
              ({activeProps.length} active)
            </span>
          )}
        </h2>

        {finalizedProps.length > 0 && (
          <div className="mb-6 bg-green-50 border border-green-300 text-green-700 text-sm px-4 py-3 space-y-1">
            {finalizedProps.map(({ id, statusLabel }) => (
              <div key={id}>✓ Proposal finalized → <strong>{statusLabel}</strong></div>
            ))}
          </div>
        )}

        {!loading && activeProps.length === 0 ? (
          <div className="bg-card border border-border p-8 text-center text-muted text-sm">
            No proposals awaiting finalization.
          </div>
        ) : (
          <div className="space-y-4">
            {activeProps.map((prop) => (
              <FinalizeCard
                key={prop.id}
                prop={prop}
                token={token}
                onDone={onFinalized}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Discussion board moderation ── */}
      <DiscussionSection token={token} />

      <p className="text-xs text-muted">
        Approval commits to GitHub → triggers Vercel redeploy → live in ~30s.
        Rejection removes from the queue with no site change.
      </p>
    </div>
  );
}
