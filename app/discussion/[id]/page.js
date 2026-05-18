"use client";

import ConnectButton from "../../components/ConnectButton";

import { useState, useEffect, useCallback, use, Suspense } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getCommonerCount } from "../../../lib/commoners";
import { usePhantomDeeplink } from "../../context/PhantomDeeplinkContext";
import Sigil from "../../components/Sigil";
import PostBody, { TweetWidgetScript } from "../../components/PostBody";



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

function ThreadPageInner({ params }) {
  const { id } = use(params);
  const { connected: adapterConnected, publicKey, signMessage } = useWallet();
  const deeplink = usePhantomDeeplink();
  const searchParams = useSearchParams();
  const router = useRouter();

  const connected =
    deeplink?.needsDeepLink ? deeplink.connected : adapterConnected;
  const walletAddress =
    deeplink?.connected && deeplink?.needsDeepLink
      ? deeplink.publicKey
      : (publicKey?.toBase58() ?? null);

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

  // ── Deep link: complete reply after returning from Phantom signing ───────────
  useEffect(() => {
    if (searchParams.get("deeplink_signed") !== "1") return;

    const pendingRaw = localStorage.getItem("phantom_pending_reply");
    const signResultRaw = localStorage.getItem("phantom_sign_result");
    if (!pendingRaw || !signResultRaw) return;

    const pending = JSON.parse(pendingRaw);
    const { signatureBase64 } = JSON.parse(signResultRaw);

    localStorage.removeItem("phantom_pending_reply");
    localStorage.removeItem("phantom_sign_result");
    router.replace(`/discussion/${id}`);

    setSubmitting(true);
    setError("");

    fetch("/api/discussion/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: pending.threadId,
        body: pending.body,
        walletAddress: pending.walletAddress,
        signature: signatureBase64,
        signedMessage: pending.signedMessage,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setReplyBody("");
          return loadThread();
        } else {
          setError(json.error || "Failed to reply.");
        }
      })
      .catch(() => setError("Network error."))
      .finally(() => setSubmitting(false));
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReply(e) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const signedMessage = `Post to The Board — Commoners DAO.\nTimestamp: ${Date.now()}`;
      const msgBytes = new TextEncoder().encode(signedMessage);

      // ── Deep link path ──────────────────────────────────────────────────
      if (deeplink?.needsDeepLink) {
        deeplink.signMessageDeepLink({
          messageBytes: msgBytes,
          returnPath: `/discussion/${id}`,
          pendingKey: "reply",
          pendingData: { threadId: id, body: replyBody, walletAddress, signedMessage },
        });
        return; // page navigates away
      }

      // ── Standard path ───────────────────────────────────────────────────
      if (!signMessage) {
        setError("Your wallet does not support message signing. Please use Phantom or Backpack.");
        setSubmitting(false);
        return;
      }
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
      <TweetWidgetScript />
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
              <Sigil wallet={post.author} size={22} />
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
              <PostBody body={post.body} />
            </div>
          </div>
        ))}
      </div>

      {/* Reply section */}
      <div className="mt-10 border-t border-border pt-6">
        {!connected ? (
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted">Connect your wallet to reply.</p>
            <ConnectButton
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
            <div className="flex items-center gap-2 text-xs text-muted uppercase tracking-widest">
              <span>Reply as</span>
              <Sigil wallet={walletAddress} size={20} />
              <span className="font-mono normal-case tracking-normal">
                {shortAddr(walletAddress)}
              </span>
            </div>
            <textarea
              required
              rows={4}
              maxLength={2000}
              placeholder="Write a reply… Paste a tweet or image URL on its own line to embed it."
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-muted/50 resize-y"
            />
            <div className="flex items-center justify-between gap-3">
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
              <p className="text-xs text-muted/70">
                Tweet/image URL on its own line embeds inline.
              </p>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </form>
        ) : null}
      </div>
    </div>
  );
}

export default function ThreadPage({ params }) {
  return (
    <Suspense fallback={null}>
      <ThreadPageInner params={params} />
    </Suspense>
  );
}
