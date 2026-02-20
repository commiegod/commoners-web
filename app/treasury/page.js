"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import idl from "../../lib/idl.json";
import { getConnection, PROGRAM_ID, configPDA } from "../../lib/programClient";

const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const AUCTION_PROGRAM = PROGRAM_ID.toBase58();
const CACHE_KEY = "treasury_v1";
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const LABEL_META = {
  "Auction Fee":         { cls: "bg-green-900/30 text-green-400 border-green-800/40",  sign: "+" },
  "Donation":            { cls: "bg-blue-900/30 text-blue-400 border-blue-800/40",    sign: "+" },
  "Artist Bounty":       { cls: "bg-orange-900/30 text-orange-400 border-orange-800/40", sign: "−" },
  "Holder Distribution": { cls: "bg-purple-900/30 text-purple-400 border-purple-800/40", sign: "−" },
  "Disbursement":        { cls: "bg-amber-900/30 text-amber-400 border-amber-800/40", sign: "−" },
};

function classifyTx(programs, solChange, memo) {
  if (solChange > 0) {
    return programs.has(AUCTION_PROGRAM) ? "Auction Fee" : "Donation";
  }
  if (memo) {
    const m = memo.toLowerCase();
    if (m.includes("bounty") || m.includes("artist")) return "Artist Bounty";
    if (m.includes("distribut") || m.includes("holder")) return "Holder Distribution";
  }
  return "Disbursement";
}

function extractMemo(instructions) {
  const memoIx = instructions.find(
    (ix) => ix.programId?.toBase58?.() === MEMO_PROGRAM
  );
  if (!memoIx) return null;
  if (typeof memoIx.parsed === "string") return memoIx.parsed;
  if (memoIx.parsed) return JSON.stringify(memoIx.parsed);
  if (memoIx.data) {
    try { return Buffer.from(memoIx.data, "base64").toString("utf8"); } catch (_) {}
  }
  return null;
}

async function loadTreasuryData(skipCache = false) {
  if (!skipCache) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) return { ...data, fromCache: true };
      }
    } catch (_) {}
  }

  const connection = getConnection();

  // Resolve treasury address from ProgramConfig
  const [cfgPda] = configPDA();
  const cfgInfo = await connection.getAccountInfo(cfgPda);
  const coder = new BorshAccountsCoder(idl);
  const cfgState = coder.decode("ProgramConfig", cfgInfo.data);
  const treasury = cfgState.treasury.toBase58();

  const treasuryPk = new PublicKey(treasury);

  const [balanceLamports, sigInfos] = await Promise.all([
    connection.getBalance(treasuryPk),
    connection.getSignaturesForAddress(treasuryPk, { limit: 50 }),
  ]);

  const sigs = sigInfos.filter((s) => !s.err).map((s) => s.signature);

  const parsed = await connection.getParsedTransactions(sigs, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  const transactions = parsed
    .map((tx, i) => {
      if (!tx || tx.meta?.err) return null;

      const keys = tx.transaction.message.accountKeys;
      const idx = keys.findIndex(
        (k) => k.pubkey?.toBase58?.() === treasury
      );
      if (idx < 0) return null;

      const solChange =
        (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / LAMPORTS_PER_SOL;

      // Ignore fee-only dust (tx fee deductions < 0.00001 SOL)
      if (Math.abs(solChange) < 0.000005) return null;

      const instructions = tx.transaction.message.instructions;
      const programs = new Set(
        instructions.map((ix) => ix.programId?.toBase58?.() ?? "").filter(Boolean)
      );
      const memo = extractMemo(instructions);
      const label = classifyTx(programs, solChange, memo);

      // Counterparty: the other non-system account involved
      const counterparty = keys
        .find(
          (k) =>
            k.pubkey?.toBase58?.() !== treasury &&
            k.pubkey?.toBase58?.() !== "11111111111111111111111111111111" &&
            k.pubkey?.toBase58?.() !== AUCTION_PROGRAM
        )
        ?.pubkey?.toBase58?.() ?? null;

      return {
        signature: sigs[i],
        blockTime: tx.blockTime,
        solChange,
        label,
        memo,
        counterparty,
      };
    })
    .filter(Boolean);

  const data = {
    treasury,
    balanceSol: balanceLamports / LAMPORTS_PER_SOL,
    transactions,
    fetchedAt: Date.now(),
  };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {}

  return data;
}

function shortAddr(addr) {
  if (!addr) return "—";
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TreasuryPage() {
  const [balance, setBalance] = useState(null);
  const [treasury, setTreasury] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (skipCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadTreasuryData(skipCache);
      setTreasury(data.treasury);
      setBalance(data.balanceSol);
      setTransactions(data.transactions);
      setFetchedAt(data.fetchedAt);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalIn = transactions
    .filter((t) => t.solChange > 0)
    .reduce((s, t) => s + t.solChange, 0);
  const totalOut = transactions
    .filter((t) => t.solChange < 0)
    .reduce((s, t) => s + t.solChange, 0);

  const updatedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <h1 className="font-blackletter text-3xl text-gold">Treasury</h1>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="text-xs text-muted hover:text-foreground border border-border px-3 py-1.5 transition-colors disabled:opacity-40"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Balance card */}
      <div className="bg-card border border-border p-6 mb-4">
        <p className="text-xs text-muted tracking-widest uppercase mb-1">
          Treasury Balance
        </p>
        <p className="text-4xl font-bold text-gold mb-1">
          {loading && balance === null
            ? "—"
            : `${balance?.toFixed(4) ?? "—"} SOL`}
        </p>
        {treasury && (
          <a
            href={`https://explorer.solana.com/address/${treasury}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-muted hover:text-foreground transition-colors"
          >
            {shortAddr(treasury)} ↗
          </a>
        )}
      </div>

      {/* Summary row */}
      {!loading && transactions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-card border border-border p-4">
            <p className="text-xs text-muted tracking-widest uppercase mb-1">
              Total In (last 50 txs)
            </p>
            <p className="text-xl font-semibold text-green-400">
              +{totalIn.toFixed(4)} SOL
            </p>
          </div>
          <div className="bg-card border border-border p-4">
            <p className="text-xs text-muted tracking-widest uppercase mb-1">
              Total Out (last 50 txs)
            </p>
            <p className="text-xl font-semibold text-amber-400">
              {totalOut.toFixed(4)} SOL
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm mb-4">Failed to load: {error}</p>
      )}

      {/* Transaction feed */}
      <h2 className="font-blackletter text-2xl text-gold mb-4">
        Transaction History
      </h2>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-card border border-border p-8 text-center text-muted">
          No transactions found.
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          {transactions.map((tx) => {
            const meta = LABEL_META[tx.label] ?? LABEL_META["Disbursement"];
            const isIn = tx.solChange > 0;
            return (
              <div
                key={tx.signature}
                className="flex items-start gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-card/40 transition-colors"
              >
                {/* Label badge */}
                <span
                  className={`shrink-0 mt-0.5 text-[11px] px-2 py-0.5 border font-medium ${meta.cls}`}
                >
                  {tx.label}
                </span>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-base font-semibold ${
                        isIn ? "text-green-400" : "text-amber-400"
                      }`}
                    >
                      {isIn ? "+" : ""}
                      {tx.solChange.toFixed(4)} SOL
                    </span>
                    <span className="text-xs text-muted shrink-0">
                      {formatDate(tx.blockTime)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    {tx.counterparty && (
                      <span className="font-mono text-xs text-muted">
                        {isIn ? "from" : "to"} {shortAddr(tx.counterparty)}
                      </span>
                    )}
                    {tx.memo && (
                      <span className="text-xs text-muted italic truncate">
                        · {tx.memo}
                      </span>
                    )}
                  </div>
                </div>

                {/* Solscan link */}
                <a
                  href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-muted hover:text-gold transition-colors mt-0.5"
                  title="View on Explorer"
                >
                  ↗
                </a>
              </div>
            );
          })}
        </div>
      )}

      {updatedLabel && (
        <p className="text-xs text-muted mt-4 text-right">
          Data from devnet · updated {updatedLabel} · cache refreshes every 2 min
        </p>
      )}
    </div>
  );
}
