"use client";

import { useState, useEffect, useCallback } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getThresholds } from "../../lib/commoners";
import { getConnection, fetchActiveAuctions, RPC_URL } from "../../lib/programClient";

const IS_DEVNET = !RPC_URL.includes("mainnet");

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

// ── Bracket admin section ─────────────────────────────────────────────────────

const REGIONS = ["east", "west", "south", "midwest"];
const REGION_LABELS = { east: "East", west: "West", south: "South", midwest: "Midwest" };
const R1_MATCHUPS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];
const ROUND_LABELS = { r1: "Round of 64", r2: "Round of 32", r3: "Sweet 16", r4: "Elite Eight" };
const STATUS_OPTIONS = ["pending", "open", "in_progress", "complete"];

function BracketAdminSection({ token }) {
  const [bracket, setBracket] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Team name editing state: { east_s1: "Duke", ... }
  const [teamNames, setTeamNames] = useState({});
  // Results editing: { r1_east_0: "east_s1", ... }
  const [resultsEdits, setResultsEdits] = useState({});
  // Status + deadline
  const [statusEdit, setStatusEdit] = useState("");
  const [deadlineEdit, setDeadlineEdit] = useState("");
  const [champWinner, setChampWinner] = useState("");
  const [champLoser, setChampLoser] = useState("");
  // Which region's teams are expanded for editing
  const [expandedRegion, setExpandedRegion] = useState(null);
  // Which round's results are expanded
  const [expandedResults, setExpandedResults] = useState(null);
  const [deletingEntryId, setDeletingEntryId] = useState(null);
  // ESPN sync state
  const [espnSyncing, setEspnSyncing] = useState(null); // "teams" | "results" | null
  const [espnMsg, setEspnMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, eRes] = await Promise.all([
        fetch("/api/bracket"),
        fetch("/api/bracket/entries"),
      ]);
      const b = await bRes.json();
      const e = await eRes.json();
      setBracket(b);
      setEntries(e.entries || []);
      setStatusEdit(b.status || "pending");
      setDeadlineEdit(b.entryDeadline ? new Date(b.entryDeadline).toISOString().slice(0,16) : "");
      setChampWinner(b.championshipScore?.winner ?? "");
      setChampLoser(b.championshipScore?.loser ?? "");
      // Pre-fill team names
      const names = {};
      for (const [regionKey, region] of Object.entries(b.regions || {})) {
        for (const t of region.teams) {
          names[t.id] = t.name === "TBD" ? "" : t.name;
        }
      }
      setTeamNames(names);
      setResultsEdits({ ...b.results });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(payload) {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/bracket-results", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setSuccessMsg("Saved.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function saveStatus() {
    const payload = { status: statusEdit };
    if (deadlineEdit) payload.entryDeadline = new Date(deadlineEdit).toISOString();
    if (champWinner !== "" && champLoser !== "") {
      payload.championshipScore = { winner: champWinner, loser: champLoser };
    }
    save(payload);
  }

  function saveTeams() {
    // Build teams object: { east: [{id, seed, name}, ...], ... }
    if (!bracket) return;
    const teams = {};
    for (const [regionKey, region] of Object.entries(bracket.regions)) {
      teams[regionKey] = region.teams.map(t => ({
        ...t,
        name: teamNames[t.id]?.trim() || "TBD",
      }));
    }
    save({ teams });
  }

  function saveResults() {
    save({ results: resultsEdits });
  }

  async function espnSync(type) {
    setEspnSyncing(type);
    setEspnMsg(null);
    const route = type === "teams"
      ? "/api/admin/bracket-sync"
      : "/api/admin/bracket-results-sync";
    try {
      const res = await fetch(route, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      if (type === "teams") {
        setEspnMsg(`Done — ${data.teamsFound} teams found, ${data.updated} updated.`);
      } else {
        const note = data.updated > 0
          ? `${data.updated} new result${data.updated !== 1 ? "s" : ""} added (${data.total} games checked).`
          : `No new results (${data.total} completed games checked).`;
        setEspnMsg(data.message ?? note);
      }
      await load();
    } catch (e) {
      setEspnMsg(`Error: ${e.message}`);
    } finally {
      setEspnSyncing(null);
    }
  }

  async function deleteEntry(id) {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    setDeletingEntryId(id);
    try {
      const res = await fetch(`/api/admin/bracket-entries/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Delete failed");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingEntryId(null);
    }
  }

  // Get all teams for a game's two slots (from edited teamNames)
  function getGameTeamOptions(gameId) {
    if (!bracket) return [];
    const all = [];
    for (const [regionKey, region] of Object.entries(bracket.regions)) {
      for (const t of region.teams) {
        all.push({ id: t.id, name: teamNames[t.id]?.trim() || t.name, seed: t.seed, region: regionKey });
      }
    }
    return all;
  }

  // Generate game list for a region + round
  function getRegionRoundGames(regionKey, round) {
    if (!bracket) return [];
    const region = bracket.regions[regionKey];
    if (!region) return [];
    const teamBySeed = {};
    for (const t of region.teams) teamBySeed[t.seed] = t;

    if (round === "r1") {
      return R1_MATCHUPS.map(([ sa, sb ], i) => ({
        id: `r1_${regionKey}_${i}`,
        labelA: `${sa} ${teamNames[`${regionKey}_s${sa}`] || "TBD"}`,
        labelB: `${sb} ${teamNames[`${regionKey}_s${sb}`] || "TBD"}`,
        teamAId: `${regionKey}_s${sa}`,
        teamBId: `${regionKey}_s${sb}`,
      }));
    }
    if (round === "r2") {
      return Array.from({length:4},(_,i) => {
        const g1 = `r1_${regionKey}_${2*i}`, g2 = `r1_${regionKey}_${2*i+1}`;
        const w1 = resultsEdits[g1], w2 = resultsEdits[g2];
        return { id: `r2_${regionKey}_${i}`, teamAId: w1||null, teamBId: w2||null,
          labelA: w1 ? (teamNames[w1]||w1) : "Winner TBD", labelB: w2 ? (teamNames[w2]||w2) : "Winner TBD" };
      });
    }
    if (round === "r3") {
      return Array.from({length:2},(_,i) => {
        const g1 = `r2_${regionKey}_${2*i}`, g2 = `r2_${regionKey}_${2*i+1}`;
        const w1 = resultsEdits[g1], w2 = resultsEdits[g2];
        return { id: `r3_${regionKey}_${i}`, teamAId: w1||null, teamBId: w2||null,
          labelA: w1 ? (teamNames[w1]||w1) : "Winner TBD", labelB: w2 ? (teamNames[w2]||w2) : "Winner TBD" };
      });
    }
    if (round === "r4") {
      const g1 = `r3_${regionKey}_0`, g2 = `r3_${regionKey}_1`;
      const w1 = resultsEdits[g1], w2 = resultsEdits[g2];
      return [{ id: `r4_${regionKey}`, teamAId: w1||null, teamBId: w2||null,
        labelA: w1 ? (teamNames[w1]||w1) : "Winner TBD", labelB: w2 ? (teamNames[w2]||w2) : "Winner TBD" }];
    }
    return [];
  }

  function getFinalFourGames() {
    if (!bracket) return [];
    const pairings = bracket.ffPairings || [["east","west"],["south","midwest"]];
    return pairings.map(([r1, r2], i) => {
      const g1 = `r4_${r1}`, g2 = `r4_${r2}`;
      const w1 = resultsEdits[g1], w2 = resultsEdits[g2];
      return { id: `ff_${i}`, teamAId: w1||null, teamBId: w2||null,
        labelA: w1 ? (teamNames[w1]||w1) : `${REGION_LABELS[r1]} winner`, labelB: w2 ? (teamNames[w2]||w2) : `${REGION_LABELS[r2]} winner` };
    });
  }

  function getChampGame() {
    const w1 = resultsEdits["ff_0"], w2 = resultsEdits["ff_1"];
    return { id: "champ", teamAId: w1||null, teamBId: w2||null,
      labelA: w1 ? (teamNames[w1]||w1) : "FF1 winner", labelB: w2 ? (teamNames[w2]||w2) : "FF2 winner" };
  }

  function ResultGameRow({ game }) {
    const winner = resultsEdits[game.id] || "";
    const options = [
      ...(game.teamAId ? [{ id: game.teamAId, label: game.labelA }] : []),
      ...(game.teamBId ? [{ id: game.teamBId, label: game.labelB }] : []),
    ];
    return (
      <div className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0 text-xs">
        <div className="flex-1 text-muted">{game.labelA} <span className="text-muted/40">vs</span> {game.labelB}</div>
        <select
          value={winner}
          onChange={e => setResultsEdits(prev => ({ ...prev, [game.id]: e.target.value || undefined }))}
          className="bg-background border border-border px-2 py-1 text-xs focus:outline-none focus:border-gold"
        >
          <option value="">— No result —</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (loading) return <p className="text-muted text-sm">Loading bracket data…</p>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-blackletter text-2xl text-gold">
          Bracket — March Madness 2026
          {!loading && (
            <span className="ml-3 text-lg font-sans text-muted font-normal">
              ({entries.length} {entries.length === 1 ? "entry" : "entries"})
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {successMsg && <span className="text-xs text-green-700">{successMsg}</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
          <button onClick={load} className="text-xs text-muted hover:text-foreground border border-border px-3 py-1.5 cursor-pointer">Refresh</button>
          <a href="/bracket" target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-foreground border border-border px-3 py-1.5">View page ↗</a>
        </div>
      </div>

      {/* Status + deadline */}
      <div className="bg-card border border-border p-4 space-y-4">
        <p className="text-xs text-muted uppercase tracking-widest">Tournament Status</p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-muted block mb-1">Status</label>
            <select
              value={statusEdit}
              onChange={e => setStatusEdit(e.target.value)}
              className="bg-background border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Entry Deadline (local time)</label>
            <input
              type="datetime-local"
              value={deadlineEdit}
              onChange={e => setDeadlineEdit(e.target.value)}
              className="bg-background border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Championship Final Score (tiebreaker)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Winner"
                value={champWinner}
                onChange={e => setChampWinner(e.target.value)}
                className="bg-background border border-border px-2 py-1.5 text-sm focus:outline-none focus:border-gold w-24"
              />
              <span className="text-muted text-sm">–</span>
              <input
                type="number"
                min="0"
                placeholder="Loser"
                value={champLoser}
                onChange={e => setChampLoser(e.target.value)}
                className="bg-background border border-border px-2 py-1.5 text-sm focus:outline-none focus:border-gold w-24"
              />
            </div>
          </div>
          <button
            onClick={saveStatus}
            disabled={saving}
            className="px-4 py-1.5 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {saving ? "Saving…" : "Save Status"}
          </button>
        </div>
      </div>

      {/* Team names */}
      <div className="bg-card border border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted uppercase tracking-widest">Team Names (after Selection Sunday)</p>
          <button
            onClick={saveTeams}
            disabled={saving}
            className="px-4 py-1.5 bg-gold text-card text-xs font-semibold rounded-full hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {saving ? "Saving…" : "Save Teams"}
          </button>
        </div>
        <div className="space-y-2">
          {REGIONS.map(regionKey => (
            <div key={regionKey} className="border border-border">
              <button
                onClick={() => setExpandedRegion(expandedRegion === regionKey ? null : regionKey)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-background/50 cursor-pointer"
              >
                <span>{REGION_LABELS[regionKey]} Region</span>
                <span className="text-muted text-xs">{expandedRegion === regionKey ? "▲ collapse" : "▼ expand"}</span>
              </button>
              {expandedRegion === regionKey && (
                <div className="border-t border-border p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(bracket?.regions[regionKey]?.teams || []).map(t => (
                    <div key={t.id}>
                      <label className="text-xs text-muted block mb-1">Seed {t.seed}</label>
                      <input
                        type="text"
                        maxLength={30}
                        placeholder="Team name"
                        value={teamNames[t.id] || ""}
                        onChange={e => setTeamNames(prev => ({ ...prev, [t.id]: e.target.value }))}
                        className="w-full bg-background border border-border px-2 py-1 text-xs focus:outline-none focus:border-gold"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ESPN Sync */}
      <div className="bg-card border border-border p-4 space-y-3">
        <p className="text-xs text-muted uppercase tracking-widest">ESPN Auto-Sync</p>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => espnSync("teams")}
            disabled={!!espnSyncing}
            className="px-4 py-1.5 border border-border text-xs hover:bg-background disabled:opacity-40 cursor-pointer"
          >
            {espnSyncing === "teams" ? "Syncing teams…" : "Sync Teams from ESPN"}
          </button>
          <button
            onClick={() => espnSync("results")}
            disabled={!!espnSyncing}
            className="px-4 py-1.5 border border-border text-xs hover:bg-background disabled:opacity-40 cursor-pointer"
          >
            {espnSyncing === "results" ? "Syncing results…" : "Sync Results from ESPN"}
          </button>
          {espnMsg && (
            <span className={`text-xs ${espnMsg.startsWith("Error") ? "text-red-500" : "text-green-700"}`}>
              {espnMsg}
            </span>
          )}
        </div>
        <p className="text-xs text-muted/60">
          Sync Teams: run once after Selection Sunday to auto-fill all 64 teams.
          Sync Results: run after each round to pull completed game winners from ESPN.
        </p>
      </div>

      {/* Results input */}
      <div className="bg-card border border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted uppercase tracking-widest">Game Results</p>
          <button
            onClick={saveResults}
            disabled={saving}
            className="px-4 py-1.5 bg-gold text-card text-xs font-semibold rounded-full hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {saving ? "Saving…" : "Save Results"}
          </button>
        </div>

        {/* Regional rounds */}
        {REGIONS.map(regionKey => (
          <div key={regionKey} className="border border-border">
            <button
              onClick={() => setExpandedResults(expandedResults === regionKey ? null : regionKey)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-background/50 cursor-pointer"
            >
              <span>{REGION_LABELS[regionKey]} Region</span>
              <span className="text-muted text-xs">{expandedResults === regionKey ? "▲ collapse" : "▼ expand"}</span>
            </button>
            {expandedResults === regionKey && (
              <div className="border-t border-border p-4 space-y-4">
                {["r1","r2","r3","r4"].map(round => (
                  <div key={round}>
                    <p className="text-xs text-muted uppercase tracking-wider mb-2">{ROUND_LABELS[round]}</p>
                    {getRegionRoundGames(regionKey, round).map(g => <ResultGameRow key={g.id} game={g} />)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Final Four + Championship */}
        <div className="border border-border p-4 space-y-4">
          <p className="text-xs text-muted uppercase tracking-wider">Final Four</p>
          {getFinalFourGames().map(g => <ResultGameRow key={g.id} game={g} />)}
          <p className="text-xs text-muted uppercase tracking-wider pt-2">Championship</p>
          <ResultGameRow game={getChampGame()} />
        </div>
      </div>

      {/* Entry list */}
      <div className="bg-card border border-border p-4 space-y-3">
        <p className="text-xs text-muted uppercase tracking-widest mb-3">
          Entries ({entries.length} total)
        </p>
        {entries.length === 0 ? (
          <p className="text-xs text-muted/60">No entries yet.</p>
        ) : (
          <div className="space-y-1">
            {entries.map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                <span className="text-muted w-6 shrink-0">#{i+1}</span>
                <span className="flex-1 font-medium truncate">{entry.username}</span>
                <span className="font-mono text-muted shrink-0">{entry.walletAddress?.slice(0,4)}…{entry.walletAddress?.slice(-4)}</span>
                <span className="font-semibold text-gold shrink-0">{entry.score ?? 0} pts</span>
                <a href={`/bracket/${entry.id}`} target="_blank" rel="noreferrer" className="text-muted hover:text-foreground shrink-0">↗</a>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  disabled={deletingEntryId === entry.id}
                  className="text-muted hover:text-red-500 transition-colors shrink-0 disabled:opacity-40 cursor-pointer"
                  title="Delete entry"
                >
                  {deletingEntryId === entry.id ? "…" : "✕"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auction Status section ────────────────────────────────────────────────────

function AuctionStatusSection() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cluster = IS_DEVNET ? "?cluster=devnet" : "";
  const now = Math.floor(Date.now() / 1000);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conn = getConnection();
      const active = await fetchActiveAuctions(conn);
      active.sort((a, b) => b.state.auction_id.toNumber() - a.state.auction_id.toNumber());
      setAuctions(active);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function shortMint(mint) {
    const s = mint.toBase58();
    return s.slice(0, 4) + "…" + s.slice(-4);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-blackletter text-2xl text-gold">
          Auction Status
          {!loading && (
            <span className="ml-3 text-lg font-sans text-muted font-normal">
              ({auctions.length} unsettled)
            </span>
          )}
        </h2>
        <button
          onClick={load}
          className="text-xs text-muted hover:text-foreground transition-colors border border-border px-3 py-1.5 cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : auctions.length === 0 ? (
        <div className="bg-card border border-border p-8 text-center text-muted text-sm">
          No unsettled auctions.
        </div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left">ID</th>
                <th className="px-4 py-2.5 text-left">NFT Mint</th>
                <th className="px-4 py-2.5 text-left">Ends</th>
                <th className="px-4 py-2.5 text-right">Bid (SOL)</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map(({ pubkey, state }) => {
                const auctionId = state.auction_id.toNumber();
                const mintStr = state.nft_mint.toBase58();
                const endTime = state.end_time.toNumber();
                const ended = endTime < now;
                const bidSol = state.current_bid.toNumber() / LAMPORTS_PER_SOL;
                const isStale = ended && !state.settled;

                return (
                  <tr
                    key={pubkey.toBase58()}
                    className={`border-b border-border last:border-0 ${isStale ? "bg-amber-50" : "hover:bg-card/60"}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{auctionId}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <a
                        href={`https://solscan.io/token/${mintStr}${cluster}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gold transition-colors"
                      >
                        {shortMint(state.nft_mint)} ↗
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(endTime * 1000).toLocaleString("en-US", {
                        month: "short", day: "numeric",
                        hour: "numeric", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {bidSol > 0 ? bidSol.toFixed(4) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isStale ? (
                        <span className="text-xs text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                          Stale
                        </span>
                      ) : (
                        <span className="text-xs text-green-700 bg-green-50 border border-green-300 px-2 py-0.5 rounded-full">
                          Live
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
      {/* ── Bracket tournament ── */}
      <BracketAdminSection token={token} />

      {/* ── Auction status ── */}
      <AuctionStatusSection />

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
