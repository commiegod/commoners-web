"use client";

import { useState, useEffect, useCallback } from "react";

function SubmissionCard({ sub, token, onDone }) {
  const [status, setStatus] = useState(null); // null | "approving" | "rejecting" | "error"

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
      {/* Thumbnail */}
      <a href={sub.imageUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
        <img
          src={sub.imageUrl}
          alt={sub.artistName}
          className="w-28 h-28 object-cover border border-border hover:opacity-90 transition-opacity"
        />
      </a>

      {/* Details */}
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

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            {status === "error" ? (
              <span className="text-xs text-red-600 self-center">
                Error — try again
              </span>
            ) : (
              <>
                <button
                  onClick={() => act("approve")}
                  disabled={!!status}
                  className="px-3 py-1.5 bg-gold text-card text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
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

        {/* Solana address */}
        <p className="text-xs font-mono text-muted break-all">{sub.solanaAddress}</p>

        {/* Social links */}
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

export default function AdminPanel({ token }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastApproved, setLastApproved] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setPending(Array.isArray(data) ? data.slice().reverse() : []); // newest first
    } catch (e) {
      setError(`Failed to load: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function onDone(id) {
    const sub = pending.find((s) => s.id === id);
    if (sub) setLastApproved(sub);
    setPending((p) => p.filter((s) => s.id !== id));
  }

  return (
    <div className="max-w-3xl">
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
          ✓ Approved <strong>{lastApproved.artistName}</strong> for {lastApproved.date} — Vercel is rebuilding (~30s).
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
              onDone={onDone}
            />
          ))}
        </div>
      )}

      <p className="mt-10 text-xs text-muted">
        Approval commits to GitHub → triggers Vercel redeploy → live in ~30s.
        Rejection removes from the queue with no site change.
      </p>
    </div>
  );
}
