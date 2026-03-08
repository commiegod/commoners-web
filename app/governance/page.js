"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { upload } from "@vercel/blob/client";
import idl from "../../lib/idl.json";
import { getConnection, configPDA, RPC_URL } from "../../lib/programClient";
import {
  getCommonerCount,
  getThresholds,
  formatTimeLeft,
  msRemaining,
  PROPOSAL_TYPES,
  TOTAL_NFTS,
} from "../../lib/commoners";
import proposalsData from "../../data/proposals.json";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

const IS_DEVNET = !RPC_URL.includes("mainnet");

const STATUS_STYLES = {
  active:  "bg-green-50 text-green-700 border border-green-300",
  passed:  "bg-green-50 text-green-700 border border-green-300",
  failed:  "bg-red-50 text-red-700 border border-red-300",
  queued:  "bg-blue-50 text-blue-700 border border-blue-300",
  pending: "bg-border/40 text-muted border border-border",
};

function StatusBadge({ status }) {
  return (
    <span className={`text-xs px-2.5 py-0.5 font-medium capitalize rounded-full ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}>
      {status}
    </span>
  );
}

// ── Proposal submission form ──────────────────────────────────────────────────

const EMPTY_FORM = { type: "community-initiative", title: "", description: "", treasurySol: "", imageUrl: "" };

function SubmitForm({ onClose, walletAddress, commonerCount }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [stage, setStage] = useState("form"); // "form" | "preview" | "done"
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const typeInfo = PROPOSAL_TYPES[form.type];
  const solAmount = parseFloat(form.treasurySol) || 0;
  const thresholds = getThresholds(form.type, solAmount);
  const short = walletAddress ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}` : "";

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleFinalSubmit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      // If a file was selected, upload it first
      let imageUrl = form.imageUrl;
      if (form._imageFile) {
        const blob = await upload(form._imageFile.name, form._imageFile, {
          access: "public",
          handleUploadUrl: "/api/bounty-upload",
        });
        imageUrl = blob.url;
      }
      const res = await fetch("/api/governance-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          description: form.description,
          treasurySol: solAmount,
          walletAddress,
          imageUrl,
        }),
      });
      const json = await res.json();
      if (json.ok) setStage("done");
      else setSubmitError(json.error || "Submission failed.");
    } catch (e) { setSubmitError(e.message || "Network error."); }
    finally { setSubmitting(false); }
  }

  if (stage === "done") {
    return (
      <div className="bg-card border border-border p-5 mb-8">
        <h3 className="font-semibold mb-2">Proposal Submitted</h3>
        <p className="text-sm text-muted mb-4">
          Your proposal has been received and will appear here once an admin approves it for a 72-hour vote.
        </p>
        <button onClick={onClose} className="text-sm text-muted border border-border px-4 py-1.5 rounded-full hover:text-foreground transition-colors cursor-pointer">
          Close
        </button>
      </div>
    );
  }

  if (stage === "preview") {
    return (
      <div className="bg-card border border-border p-5 mb-8">
        <p className="text-xs text-muted uppercase tracking-widest mb-4">Review Your Proposal</p>
        <div className="space-y-2 mb-5 text-sm">
          <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr] gap-2"><span className="text-muted">Type</span><span>{typeInfo?.label}</span></div>
          <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr] gap-2"><span className="text-muted">Title</span><span className="font-semibold">{form.title}</span></div>
          {solAmount > 0 && <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr] gap-2"><span className="text-muted">Treasury ask</span><span className="text-gold font-semibold">{solAmount} SOL</span></div>}
          <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr] gap-2"><span className="text-muted">Threshold</span><span className="text-muted">{thresholds.majority}% majority · {thresholds.quorum}/{TOTAL_NFTS} quorum</span></div>
          <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr] gap-2"><span className="text-muted">Proposer</span><span className="font-mono text-xs text-muted">{short}</span></div>
        </div>
        <div className="border-t border-border pt-4 mb-5">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Description</p>
          <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">{form.description}</p>
          {form.imageUrl && (
            <img src={form.imageUrl} alt="preview" className="mt-3 max-h-48 object-cover border border-border" />
          )}
        </div>
        {submitError && <p className="text-xs text-red-600 mb-3">{submitError}</p>}
        <div className="flex gap-2">
          <button onClick={handleFinalSubmit} disabled={submitting} className="px-4 py-1.5 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-50">
            {submitting ? "Submitting…" : "Submit Proposal"}
          </button>
          <button onClick={() => setStage("form")} className="px-4 py-1.5 border border-border text-muted text-sm rounded-full hover:text-foreground transition-colors cursor-pointer">
            ← Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setStage("preview"); }} className="bg-card border border-border p-5 mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Submit a Proposal</h3>
        <button type="button" onClick={onClose} className="text-muted hover:text-foreground text-lg leading-none transition-colors cursor-pointer">×</button>
      </div>

      {commonerCount === 0 && (
        <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-300 px-3 py-2">
          You need at least one Commoner NFT to submit a proposal.{" "}
          <a href="https://magiceden.io/marketplace/midevilsnft" target="_blank" rel="noopener noreferrer" className="underline">View on Magic Eden ↗</a>
        </p>
      )}

      <div>
        <label className="block text-xs text-muted mb-1">Proposal type</label>
        <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full bg-background border border-border text-sm px-3 py-2">
          {Object.entries(PROPOSAL_TYPES).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted mt-1">{typeInfo?.description}</p>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Title</label>
        <input type="text" required maxLength={120} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Short, specific proposal title" className="w-full bg-background border border-border text-sm px-3 py-2 placeholder:text-muted/50" />
      </div>

      {typeInfo?.treasury && (
        <div>
          <label className="block text-xs text-muted mb-1">Treasury request (SOL)</label>
          <input type="number" min="0" step="0.1" value={form.treasurySol} onChange={(e) => set("treasurySol", e.target.value)} placeholder="0.00" className="w-full bg-background border border-border text-sm px-3 py-2 placeholder:text-muted/50" />
          {solAmount > 20 && <p className="text-xs text-blue-700 mt-1">Requires 75% supermajority</p>}
          {solAmount >= 5 && solAmount <= 20 && <p className="text-xs text-gold mt-1">Requires 67% supermajority, 36/120 quorum</p>}
        </div>
      )}

      <div>
        <label className="block text-xs text-muted mb-1">Description</label>
        <textarea required rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe the proposal, why it matters, and what success looks like." className="w-full bg-background border border-border text-sm px-3 py-2 placeholder:text-muted/50 resize-y" />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Supporting image <span className="text-muted/60">(optional)</span></label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              set("_imageFile", file);
              set("imageUrl", URL.createObjectURL(file));
            }
          }}
          className="w-full text-sm text-muted file:mr-3 file:px-3 file:py-1.5 file:bg-background file:border file:border-border file:text-sm file:text-foreground hover:file:border-foreground file:cursor-pointer"
        />
        {form.imageUrl && (
          <img src={form.imageUrl} alt="preview" className="mt-2 max-h-40 object-cover border border-border" />
        )}
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={!form.title.trim() || !form.description.trim() || commonerCount === 0} className="px-4 py-1.5 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
          Preview
        </button>
        <button type="button" onClick={onClose} className="px-4 py-1.5 border border-border text-muted text-sm rounded-full hover:text-foreground transition-colors cursor-pointer">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Proposal row ──────────────────────────────────────────────────────────────

function ProposalRow({ proposal, index }) {
  const isActive = proposal.status === "active";
  const timeLeft = isActive ? formatTimeLeft(proposal.endsAt) : null;
  const typeInfo = PROPOSAL_TYPES[proposal.type];

  return (
    <Link href={`/governance/${proposal.id}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border hover:bg-card/60 transition-colors cursor-pointer group">
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-muted text-sm font-mono shrink-0">#{index + 1}</span>
          <div className="min-w-0">
            <p className="font-medium truncate">{proposal.title}</p>
            <p className="text-xs text-muted mt-0.5">{typeInfo?.label ?? proposal.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {timeLeft && <span className="text-xs text-muted hidden sm:block">{timeLeft}</span>}
          {!isActive && (
            <span className="text-xs text-muted hidden sm:block">
              {new Date(proposal.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          <StatusBadge status={proposal.status} />
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GovernancePage() {
  const { connected, publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [commonerCount, setCommonerCount] = useState(0);
  const [checkingHolder, setCheckingHolder] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [balanceSol, setBalanceSol] = useState(null);
  const [treasury, setTreasury] = useState(null);

  // Fetch treasury balance from on-chain config
  useEffect(() => {
    async function fetchBalance() {
      try {
        const conn = getConnection();
        const [cfgPda] = configPDA();
        const cfgInfo = await conn.getAccountInfo(cfgPda);
        if (!cfgInfo) return;
        const coder = new BorshAccountsCoder(idl);
        const cfg = coder.decode("ProgramConfig", cfgInfo.data);
        const addr = cfg.treasury.toBase58();
        setTreasury(addr);
        const bal = await conn.getBalance(new PublicKey(addr));
        setBalanceSol(bal / LAMPORTS_PER_SOL);
      } catch {}
    }
    fetchBalance();
  }, []);

  // Check Commoner NFT holdings
  useEffect(() => {
    if (!walletAddress) { setCommonerCount(0); return; }
    setCheckingHolder(true);
    getCommonerCount(walletAddress).then((n) => {
      setCommonerCount(n);
      setCheckingHolder(false);
    });
  }, [walletAddress]);

  const activeProposals = proposalsData.filter((p) => p.status === "active");
  const pastProposals = proposalsData.filter((p) => p.status !== "active");
  const cluster = IS_DEVNET ? "?cluster=devnet" : "";

  return (
    <div className="max-w-3xl">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm text-muted mb-1">Governance</p>
          <h1 className="font-blackletter text-2xl sm:text-4xl text-foreground leading-tight">
            Commoner&apos;s DAO
          </h1>
        </div>

        <div className="shrink-0 pt-1">
          {connected ? (
            commonerCount > 0 && !showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-gold text-card text-sm font-semibold rounded-full hover:opacity-90 transition-opacity cursor-pointer shrink-0"
              >
                Submit Proposal
              </button>
            ) : !showForm ? (
              <span className="text-xs text-muted">
                {checkingHolder ? "Checking…" : "No Commoner NFTs found"}
              </span>
            ) : null
          ) : (
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
          )}
        </div>
      </div>

      {/* ── Description ── */}
      <p className="text-muted leading-relaxed mb-6 max-w-2xl">
        Commoner NFT holders govern <strong className="text-foreground">Commoner&apos;s DAO</strong>.
        Each NFT held equals one vote. Holders may submit and vote on proposals directly on this page.{" "}
        <a
          href="https://github.com/commiegod/commoners-web/blob/main/GOVERNANCE.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold hover:underline"
        >
          Governance doc ↗
        </a>
      </p>

      {/* ── Treasury card ── */}
      <div className="border border-border p-5 mb-8 grid sm:grid-cols-2 gap-5 sm:gap-0 sm:divide-x sm:divide-border">
        <div className="sm:pr-6">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-muted tracking-widest uppercase">Treasury</p>
            {IS_DEVNET && (
              <span className="text-[10px] font-semibold px-1.5 py-px rounded border border-amber-300 text-amber-600 bg-amber-50 uppercase tracking-wide leading-none">
                Devnet
              </span>
            )}
          </div>
          <p className="text-3xl font-bold">
            {balanceSol !== null ? `${balanceSol.toFixed(4)} SOL` : "—"}
          </p>
          {treasury && (
            <Link
              href="/treasury"
              className="text-xs text-muted hover:text-gold transition-colors mt-1 inline-block"
            >
              Transaction history ↗
            </Link>
          )}
        </div>
        <div className="sm:pl-6 text-sm text-muted leading-relaxed">
          This treasury exists for Commoner&apos;s DAO participants to allocate
          resources for the long-term growth and prosperity of the project.
          Funds are released by holder vote.
        </div>
      </div>

      {/* ── Submit form ── */}
      {showForm && (
        <SubmitForm
          onClose={() => setShowForm(false)}
          walletAddress={walletAddress}
          commonerCount={commonerCount}
        />
      )}

      {/* ── Voting rules (compact) ── */}
      <div className="flex flex-wrap gap-2 text-xs mb-8 border-b border-border pb-4">
        <span className="bg-card border border-border px-3 py-1 rounded-full"><span className="text-foreground font-medium">Eligibility</span> — ≥1 Commoner NFT</span>
        <span className="bg-card border border-border px-3 py-1 rounded-full"><span className="text-foreground font-medium">Standard</span> — 51% majority, 24/120 quorum</span>
        <span className="bg-card border border-border px-3 py-1 rounded-full"><span className="text-foreground font-medium">Treasury 5–20 SOL</span> — 67%, 36/120</span>
        <span className="bg-card border border-border px-3 py-1 rounded-full"><span className="text-foreground font-medium">Window</span> — 72 hours</span>
        <span className="bg-card border border-border px-3 py-1 rounded-full"><span className="text-foreground font-medium">Voting power</span> — 1 vote per NFT</span>
      </div>

      {/* ── Holder status ── */}
      {connected && (
        <div className={`mb-6 px-4 py-2.5 text-sm flex items-center justify-between gap-4 ${
          checkingHolder ? "text-muted" :
          commonerCount > 0 ? "bg-green-50 border border-green-300 text-green-700" :
          "bg-yellow-50 border border-yellow-300 text-yellow-700"
        }`}>
          <span>
            {checkingHolder ? "Checking Commoner NFT holdings…" :
             commonerCount > 0 ? `${commonerCount} Commoner NFT${commonerCount > 1 ? "s" : ""} · ${commonerCount} vote${commonerCount > 1 ? "s" : ""}` :
             "No Commoner NFTs — voting restricted to holders"}
          </span>
          <span className="font-mono text-xs opacity-60">{walletAddress?.slice(0,4)}…{walletAddress?.slice(-4)}</span>
        </div>
      )}

      {/* ── How It Works ── */}
      <div className="grid sm:grid-cols-3 gap-px bg-border mb-10">
        {[
          {
            n: "1",
            title: "Submit",
            body: "Any Commoner NFT holder can submit a proposal. An admin reviews it and posts it on-chain to open a 72-hour voting window.",
          },
          {
            n: "2",
            title: "Vote",
            body: "Connect your wallet and split your votes (1 per Commoner NFT) across For, Against, or Abstain. Each vote is a signed Solana transaction — permanent and publicly verifiable.",
          },
          {
            n: "3",
            title: "Execute",
            body: "If the proposal meets the required majority and quorum, it passes. Treasury disbursements are currently executed by admin after confirmation; autonomous execution is planned for a future phase.",
          },
        ].map(({ n, title, body }) => (
          <div key={n} className="bg-background p-5">
            <p className="text-xs text-muted tracking-widest uppercase mb-1">Step {n}</p>
            <p className="font-semibold text-sm mb-2">{title}</p>
            <p className="text-xs text-muted leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* ── Active proposals ── */}
      <section className="mb-10">
        <div className="border border-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-card flex items-center justify-between">
            <h2 className="font-blackletter text-xl text-foreground tracking-wide">Active Proposals</h2>
          </div>

          {activeProposals.length === 0 ? (
            <div className="px-5 py-10 text-center text-muted">
              <p>No active proposals.</p>
              <p className="text-xs mt-1">
                {connected && commonerCount > 0
                  ? "Be the first — click Submit Proposal above."
                  : "Connect your wallet and hold a Commoner NFT to submit."}
              </p>
            </div>
          ) : (
            activeProposals.map((p, i) => <ProposalRow key={p.id} proposal={p} index={i} />)
          )}
        </div>
      </section>

      {/* ── Past proposals ── */}
      {pastProposals.length > 0 && (
        <section>
          <div className="border border-border overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-card">
              <h2 className="font-blackletter text-xl text-foreground tracking-wide">Past Proposals</h2>
            </div>
            {pastProposals.map((p, i) => (
              <ProposalRow key={p.id} proposal={p} index={activeProposals.length + i} />
            ))}
          </div>
        </section>
      )}

      {/* ── governance note ── */}
      <p className="text-xs text-muted mt-10 border-t border-border pt-4">
        Approved proposals are recorded on-chain. Autonomous proposal execution is planned for a future phase.
      </p>
    </div>
  );
}
