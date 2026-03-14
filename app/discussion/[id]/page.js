"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getCommonerCount } from "../../../lib/commoners";

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

export default function ThreadPage({ params }) {
  const { id } = use(params);
  const { connected, publicKey, signMessage } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [commonerCount, setCommonerCount] = useState(0);
  const [checkingHolder, setCheckingHolder] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadThread = useCallback(async () => {
    try {
      // Fetch all threads (no limit) to find this specific one by ID.
      // Once a dedicated /api/discussion/[id] endpoint exists this can be simplified.
      const res = await fetch("/api/discussion?limit=50&page=1");
      if (res.ok) {
        const data = await res.json();
        let found = (data.threads ?? []).find((t) => t.id === id);
        // If not on first page, fetch remaining pages
        for (let p = 2; !found && p <= (data.pages ?? 1); p++) {
          const r2 = await fetch(`/api/discussion?limit=50&page=${p}`);
          if (r2.ok) {
            const d2 = await r2.json();
            found = (d2.threads ?? []).find((t) => t.id === id);
          }
        }
        if (found) setThread(found);
        else setNotFound(true);
      }
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

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

  async function handleReply(e) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      if (!signMessage) {
        setError("Your wallet does not support message signing. Please use Phantom or Backpack.");
        setSubmitting(false);
        return;
      }
      const signedMessage = `Post to The Board — Commoners DAO.\nTimestamp: ${Date.now()}`;
      const msgBytes = new TextEncoder().encode(signedMessage);
      const signatureBytes = await signMessage(msgBytes);
      const signature = Buffer.from(signatureBytes).toString("base64");

      const res = await fetch("/api/discussion/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: id, body: replyBody, walletAddress, signature, signedMessage }),
      });
      const json = await res.json();
      if (json.ok) {
        setReplyBody("");
        await loadThread();
      } else {
        setError(json.error || "Failed to reply.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const canPost = connected && !checkingHolder && commonerCount > 0;

  if (loading) {
    return (
      <div className="max-w-3xl space-y-3">
        <div className="h-4 w-20 bg-card border border-border animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-3xl">
        <Link
          href="/discussion"
          className="text-sm text-muted hover:text-foreground mb-6 inline-block cursor-pointer"
        >
          ← Board
        </Link>
        <p className="text-muted">Thread not found.</p>
      </div>
    );
  }

  const posts = [
    { ...thread, isOp: true, num: 0 },
    ...thread.replies.map((r, i) => ({ ...r, isOp: false, num: i + 1 })),
  ];

  return (
    <div className="max-w-3xl">
      <Link
        href="/discussion"
        className="text-sm text-muted hover:text-foreground mb-8 inline-block cursor-pointer"
      >
        ← Board
      </Link>

      <div className="space-y-3">
        {posts.map((post) => (
          <div
            key={post.id}
            className={`border border-border overflow-hidden ${post.isOp ? "" : "ml-4"}`}
          >
            {/* Post header */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card text-xs text-muted">
              <span className="text-foreground font-semibold font-mono">
                #{post.num}
              </span>
              <span>·</span>
              <span className="font-mono">{shortAddr(post.author)}</span>
              <span>·</span>
              <span>{timeAgo(post.timestamp)}</span>
              {post.isOp && (
                <span className="ml-auto text-[10px] tracking-widest uppercase text-muted border border-border px-1.5 py-0.5">
                  OP
                </span>
              )}
            </div>

            {/* Subject (OP only) */}
            {post.isOp && (
              <div className="px-4 pt-4 pb-1">
                <h1 className="font-semibold text-lg text-foreground leading-tight">
                  {thread.subject}
                </h1>
              </div>
            )}

            {/* Body */}
            <div className="px-4 py-3">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {post.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply section */}
      <div className="mt-10 border-t border-border pt-6">
        {!connected ? (
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted">Connect your wallet to reply.</p>
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
          </div>
        ) : !checkingHolder && commonerCount === 0 ? (
          <p className="text-sm text-muted">
            No Commoner NFTs found — posting restricted to holders.{" "}
            <a
              href="https://magiceden.io/marketplace/midevilsnft"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Find one ↗
            </a>
          </p>
        ) : canPost ? (
          <form onSubmit={handleReply} className="space-y-3">
            <p className="text-xs text-muted uppercase tracking-widest">
              Reply as {shortAddr(walletAddress)}
            </p>
            <textarea
              required
              rows={4}
              maxLength={2000}
              placeholder="Write a reply…"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-muted/50 resize-y"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || !replyBody.trim()}
                className="px-4 py-1.5 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                {submitting ? "Posting…" : "Reply"}
              </button>
              <span className="text-xs text-muted">{replyBody.length} / 2000</span>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </form>
        ) : null}
      </div>
    </div>
  );
}
