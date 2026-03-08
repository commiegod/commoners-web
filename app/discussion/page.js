"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getCommonerCount } from "../../lib/commoners";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortAddr(addr) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

export default function DiscussionPage() {
  const { connected, publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commonerCount, setCommonerCount] = useState(0);
  const [checkingHolder, setCheckingHolder] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/discussion");
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

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
  }, [walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, walletAddress }),
      });
      const json = await res.json();
      if (json.ok) {
        setSubject("");
        setBody("");
        setShowForm(false);
        await loadThreads();
      } else {
        setError(json.error || "Failed to post.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const canPost = connected && !checkingHolder && commonerCount > 0;

  return (
    <div>
      {/* Hero banner — full-bleed */}
      <div
        style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
        className="overflow-hidden mb-8"
      >
        <img
          src="/banner-the-board.png"
          alt="A MidEvil writing by candlelight"
          className="w-full object-cover"
          style={{ height: "220px", objectPosition: "center 30%" }}
        />
      </div>

      <div className="max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-y-2 mb-6">
        <div>
          <h1 className="font-blackletter text-4xl text-foreground">The Board</h1>
          <p className="text-xs text-muted mt-1">
            Commoner NFT holders only
            {!loading && (
              <span> · {threads.length} thread{threads.length !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>

        <div className="shrink-0 pb-1">
          {!connected ? (
            <WalletMultiButton
              style={{
                backgroundColor: "transparent",
                border: "1px solid #1a1a1a",
                color: "#1a1a1a",
                fontSize: "0.75rem",
                borderRadius: "9999px",
                height: "auto",
                padding: "0.375rem 0.75rem",
                lineHeight: 1.5,
              }}
            />
          ) : canPost && !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 transition-opacity cursor-pointer"
            >
              New Thread
            </button>
          ) : null}
        </div>
      </div>

      {/* New thread form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border p-5 mb-8 space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted uppercase tracking-widest">New Thread</p>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-muted hover:text-foreground text-lg leading-none cursor-pointer"
            >
              ×
            </button>
          </div>

          <input
            type="text"
            required
            maxLength={120}
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-muted/50"
          />

          <div>
            <textarea
              required
              rows={5}
              maxLength={2000}
              placeholder="What's on your mind?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-muted/50 resize-y"
            />
            <p className="text-right text-xs text-muted mt-1">{body.length} / 2000</p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !subject.trim() || !body.trim()}
              className="px-4 py-1.5 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 cursor-pointer"
            >
              {submitting ? "Posting…" : "Post Thread"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-border text-muted text-sm rounded-full hover:text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Not a holder notice */}
      {connected && !checkingHolder && commonerCount === 0 && (
        <p className="text-xs text-muted mb-6 border border-border px-4 py-2.5">
          No Commoner NFTs found — posting restricted to holders.{" "}
          <a
            href="https://magiceden.io/marketplace/midevilsnft"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Find one on Magic Eden ↗
          </a>
        </p>
      )}

      {/* Thread list */}
      {loading ? (
        <div className="space-y-px">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="border border-border p-16 text-center text-muted">
          <p>No threads yet.</p>
          <p className="text-xs mt-1">
            {canPost ? "Click New Thread to start the conversation." : "Connect a holder wallet to post."}
          </p>
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          {threads.map((thread, i) => (
            <Link
              key={thread.id}
              href={`/discussion/${thread.id}`}
              className={`block px-5 py-4 hover:bg-card/60 transition-colors cursor-pointer ${
                i < threads.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <p className="font-semibold text-foreground mb-1 truncate">{thread.subject}</p>
              <p className="text-sm text-muted line-clamp-2 mb-2.5 leading-snug">{thread.body}</p>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="font-mono">{shortAddr(thread.author)}</span>
                <span>·</span>
                <span>{timeAgo(thread.timestamp)}</span>
                <span>·</span>
                <span>
                  {thread.replies.length}{" "}
                  {thread.replies.length === 1 ? "reply" : "replies"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-muted mt-6 text-right">
        Public read · holder-gated write
      </p>
    </div>
    </div>
  );
}
