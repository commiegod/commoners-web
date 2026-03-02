"use client";

import { useState, useEffect, useCallback } from "react";
import commoners from "../../data/commoners.json";
import { RPC_URL } from "../../lib/programClient";

const IS_DEVNET = !RPC_URL.includes("mainnet");

// Commoners are mainnet NFTs — always query mainnet DAS regardless of which
// devnet RPC the auction program uses.
const MAINNET_RPC =
  process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

const CACHE_KEY = "holders_v1";
const CACHE_TTL = 5 * 60 * 1000;
const MINTS = commoners.nfts.map((n) => n.id);

// mint → NFT name for expanded rows
const mintToName = {};
for (const nft of commoners.nfts) mintToName[nft.id] = nft.name;

function shortWallet(addr) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-card border border-border p-4 flex flex-col gap-1">
      <p className="text-xs text-muted tracking-widest uppercase">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

async function loadHolders(skipCache = false) {
  if (!skipCache) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) return { ...data, fromCache: true };
      }
    } catch (_) {}
  }

  const res = await fetch(MAINNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "holders",
      method: "getAssetBatch",
      params: { ids: MINTS },
    }),
  });

  const json = await res.json();
  const assets = json.result || [];

  const ownerMap = {};
  for (const asset of assets) {
    const owner = asset?.ownership?.owner;
    const mint = asset?.id;
    if (!owner || !mint) continue;
    if (!ownerMap[owner]) ownerMap[owner] = [];
    ownerMap[owner].push(mint);
  }

  const leaderboard = Object.entries(ownerMap)
    .map(([wallet, mints]) => ({ wallet, count: mints.length, mints }))
    .sort((a, b) => b.count - a.count);

  const data = { leaderboard, fetchedAt: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {}

  return { ...data, fromCache: false };
}

export default function HoldersPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const fetch_ = useCallback(async (skipCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadHolders(skipCache);
      setLeaderboard(result.leaderboard);
      setFetchedAt(result.fetchedAt);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const uniqueHolders = leaderboard.length;
  const avgPerHolder =
    uniqueHolders > 0 ? (120 / uniqueHolders).toFixed(1) : "—";
  const topHolder = leaderboard[0]?.count ?? 0;

  // Additional stats
  const top10Count = leaderboard.slice(0, 10).reduce((s, r) => s + r.count, 0);
  const top10Pct = uniqueHolders > 0 ? ((top10Count / 120) * 100).toFixed(1) : "—";
  const singleHolders = leaderboard.filter((r) => r.count === 1).length;

  // Distribution buckets: 1, 2, 3, 4, 5+
  const distBuckets = [1, 2, 3, 4, 5].map((n) => ({
    label: n === 5 ? "5+" : String(n),
    count: leaderboard.filter((r) => (n === 5 ? r.count >= 5 : r.count === n)).length,
  }));
  const distMax = Math.max(...distBuckets.map((b) => b.count), 1);

  const updatedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <h1 className="font-blackletter text-3xl text-gold">Holders</h1>
        <button
          onClick={() => fetch_(true)}
          disabled={loading}
          className="text-xs text-muted hover:text-foreground border border-border px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 cursor-pointer"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Stat bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard
          label="Unique Holders"
          value={loading ? "—" : uniqueHolders}
        />
        <StatCard label="Total Supply" value={120} sub="3-trait MidEvils" />
        <StatCard
          label="Avg per Holder"
          value={loading ? "—" : avgPerHolder}
        />
        <StatCard
          label="Largest Holder"
          value={loading ? "—" : topHolder}
          sub={`updated ${updatedLabel}`}
        />
        <StatCard
          label="Top 10 Hold"
          value={loading ? "—" : `${top10Pct}%`}
          sub="concentration"
        />
        <StatCard
          label="Single Holders"
          value={loading ? "—" : singleHolders}
          sub="hold exactly 1"
        />
      </div>

      {/* Distribution */}
      {!loading && leaderboard.length > 0 && (
        <div className="bg-card border border-border p-4 mb-8">
          <p className="text-xs text-muted tracking-widest uppercase mb-3">Holdings Distribution</p>
          <div className="space-y-2">
            {distBuckets.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-xs text-muted w-8 text-right shrink-0">{b.label} NFT{b.label !== "1" ? "s" : ""}</span>
                <div className="flex-1 h-2 bg-border overflow-hidden">
                  <div
                    className="h-full bg-foreground/40 transition-all duration-500"
                    style={{ width: `${(b.count / distMax) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted w-24 shrink-0">
                  {b.count} wallet{b.count !== 1 ? "s" : ""}
                  {uniqueHolders > 0 && (
                    <span className="ml-1 text-foreground/60">({((b.count / uniqueHolders) * 100).toFixed(0)}%)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm mb-4">Failed to load: {error}</p>
      )}

      {/* Leaderboard */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-10 bg-card border border-border animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2rem_1fr_5rem_8rem] gap-4 px-4 py-2 bg-card border-b border-border text-xs text-muted tracking-widest uppercase">
            <span>#</span>
            <span>Wallet</span>
            <span className="text-right">Held</span>
            <span className="text-right">% of Supply</span>
          </div>

          {leaderboard.map((row, i) => {
            const pct = ((row.count / 120) * 100).toFixed(1);
            const isExpanded = expanded === row.wallet;

            return (
              <div key={row.wallet} className="border-b border-border last:border-0">
                <button
                  onClick={() =>
                    setExpanded(isExpanded ? null : row.wallet)
                  }
                  className="w-full grid grid-cols-[2rem_1fr_5rem_8rem] gap-4 px-4 py-3 text-left hover:bg-card/50 transition-colors cursor-pointer"
                >
                  <span className="text-muted text-sm">{i + 1}</span>
                  <span className="font-mono text-sm truncate">
                    <a
                      href={`https://solscan.io/account/${row.wallet}${IS_DEVNET ? "?cluster=devnet" : ""}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-gold transition-colors"
                    >
                      {shortWallet(row.wallet)}
                    </a>
                  </span>
                  <span className="text-right text-sm font-semibold text-gold">
                    {row.count}
                  </span>
                  <span className="text-right text-sm text-muted">{pct}%</span>
                </button>

                {/* Expanded NFT list */}
                {isExpanded && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {row.mints.map((mint) => (
                      <span
                        key={mint}
                        className="text-[11px] px-2 py-0.5 bg-gold/10 border border-gold/20 text-gold/80"
                      >
                        {mintToName[mint] || shortWallet(mint)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted mt-4 text-right">
        Data from Helius · cache refreshes every 5 min
      </p>
    </div>
  );
}
