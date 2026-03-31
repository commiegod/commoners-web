"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import Link from "next/link";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

const MIDEVILS_COLLECTION = "w44WvLKRdLGye2ghhDJBxcmnWpBo31A1tCBko2G6DgW";
const MAINNET_RPC =
  process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

async function checkMidEvilCount(walletAddress) {
  if (!walletAddress) return 0;
  if (!MAINNET_RPC.includes("helius")) return 0;
  try {
    const res = await fetch(MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "midevil-check",
        method: "getAssetsByOwner",
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 1000,
          displayOptions: { showFungible: false, showNativeBalance: false },
        },
      }),
    });
    const json = await res.json();
    const items = json.result?.items ?? [];
    return items.filter((a) =>
      a.grouping?.some(
        (g) =>
          g.group_key === "collection" && g.group_value === MIDEVILS_COLLECTION
      )
    ).length;
  } catch {
    return 0;
  }
}

function buildRepickMessage(entryId) {
  return `FF repick for bracket entry ${entryId}.\nTimestamp: ${Date.now()}`;
}

function TeamButton({ team, selected, onClick, disabled }) {
  if (!team) return null;
  return (
    <button
      onClick={() => !disabled && onClick(team.id)}
      disabled={disabled}
      className={`flex-1 px-4 py-3 rounded border text-sm font-medium transition-all cursor-pointer ${
        selected
          ? "border-gold bg-gold/10 text-gold"
          : disabled
          ? "border-border bg-card text-muted cursor-not-allowed"
          : "border-border bg-card text-foreground hover:border-gold/60"
      }`}
    >
      <div className="font-semibold">{team.name}</div>
      {team.seed && (
        <div className="text-xs text-muted mt-0.5">#{team.seed} seed</div>
      )}
    </button>
  );
}

function EntryRepickForm({ entry, bracket, onDone }) {
  const { publicKey, signMessage } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [ff0Pick, setFf0Pick] = useState(null);
  const [ff1Pick, setFf1Pick] = useState(null);
  const [champPick, setChampPick] = useState(null);
  const [tiebreaker, setTiebreaker] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Derive the 4 FF teams from bracket results
  const results = bracket.results ?? {};
  const ffPairings = bracket.ffPairings ?? [];

  function getTeamById(id) {
    if (!id) return null;
    for (const region of Object.values(bracket.regions ?? {})) {
      const t = (region.teams ?? []).find((t) => t.id === id);
      if (t) return t;
    }
    return null;
  }

  // ff_0: east vs south; ff_1: west vs midwest
  const ff0TeamA = getTeamById(results.r4_east);
  const ff0TeamB = getTeamById(results.r4_south);
  const ff1TeamA = getTeamById(results.r4_west);
  const ff1TeamB = getTeamById(results.r4_midwest);

  const champTeamA = ff0Pick ? getTeamById(ff0Pick) : null;
  const champTeamB = ff1Pick ? getTeamById(ff1Pick) : null;

  // Clear champ if it's no longer reachable
  const handleFf0 = useCallback((id) => {
    setFf0Pick(id);
    setChampPick((prev) => (prev === id || (ff1Pick && prev === ff1Pick) ? prev : null));
  }, [ff1Pick]);

  const handleFf1 = useCallback((id) => {
    setFf1Pick(id);
    setChampPick((prev) => (prev === id || (ff0Pick && prev === ff0Pick) ? prev : null));
  }, [ff0Pick]);

  const tiebreakerVal = tiebreaker === "" ? null : parseInt(tiebreaker, 10);
  const tiebreakerValid = tiebreakerVal !== null && Number.isInteger(tiebreakerVal) && tiebreakerVal >= 0;
  const canSubmit = ff0Pick && ff1Pick && champPick && tiebreakerValid && walletAddress && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !signMessage) return;
    setSubmitting(true);
    setError(null);
    try {
      const msg = buildRepickMessage(entry.id);
      const msgBytes = new TextEncoder().encode(msg);
      const sigBytes = await signMessage(msgBytes);
      const signature = Buffer.from(sigBytes).toString("base64");

      const res = await fetch(`/api/bracket/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          signature,
          signedMessage: msg,
          ff_0: ff0Pick,
          ff_1: ff1Pick,
          champ: champPick,
          tiebreaker: tiebreakerVal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
        return;
      }
      setSuccess(true);
      onDone(entry.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-card border border-border rounded px-4 py-4 text-sm text-foreground">
        ✓ Picks saved for <span className="text-gold font-medium">{entry.username}</span>
      </div>
    );
  }

  return (
    <div className="border border-border rounded bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-medium text-foreground">{entry.username}</p>
        <p className="text-xs text-muted mt-0.5">Re-pick your Final Four games below</p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-6">

        {/* Final Four Game 1 */}
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-2">
            Final Four · Game 1
            <span className="ml-2 text-gold/70 normal-case">East vs South · Apr 4, 6:09 PM ET</span>
          </p>
          <div className="flex gap-2">
            <TeamButton team={ff0TeamA} selected={ff0Pick === ff0TeamA?.id} onClick={handleFf0} />
            <div className="flex items-center text-xs text-muted font-medium px-1">vs</div>
            <TeamButton team={ff0TeamB} selected={ff0Pick === ff0TeamB?.id} onClick={handleFf0} />
          </div>
        </div>

        {/* Final Four Game 2 */}
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-2">
            Final Four · Game 2
            <span className="ml-2 text-gold/70 normal-case">West vs Midwest · Apr 4, 8:49 PM ET</span>
          </p>
          <div className="flex gap-2">
            <TeamButton team={ff1TeamA} selected={ff1Pick === ff1TeamA?.id} onClick={handleFf1} />
            <div className="flex items-center text-xs text-muted font-medium px-1">vs</div>
            <TeamButton team={ff1TeamB} selected={ff1Pick === ff1TeamB?.id} onClick={handleFf1} />
          </div>
        </div>

        {/* Championship */}
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-2">
            Championship
            <span className="ml-2 text-gold/70 normal-case">Apr 7, 9:20 PM ET</span>
          </p>
          {champTeamA && champTeamB ? (
            <div className="flex gap-2">
              <TeamButton team={champTeamA} selected={champPick === champTeamA?.id} onClick={setChampPick} />
              <div className="flex items-center text-xs text-muted font-medium px-1">vs</div>
              <TeamButton team={champTeamB} selected={champPick === champTeamB?.id} onClick={setChampPick} />
            </div>
          ) : (
            <p className="text-xs text-muted italic">Pick both Final Four games first</p>
          )}
        </div>

        {/* Tiebreaker */}
        {champTeamA && champTeamB && (
          <div className="max-w-xs border border-gold/30 rounded bg-background px-4 py-3">
            <p className="text-xs text-gold uppercase tracking-widest mb-1">Tiebreaker</p>
            <p className="text-sm text-foreground font-medium mb-0.5">
              {champTeamA && champTeamB
                ? `${champTeamA.name} vs. ${champTeamB.name}`
                : "Championship Game"}
            </p>
            <p className="text-xs text-muted mb-3">
              Predicted combined total score — used to break ties.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={tiebreaker}
                onChange={(e) => setTiebreaker(e.target.value)}
                placeholder="e.g. 145"
                className="w-28 border border-border bg-background text-foreground text-sm px-3 py-2 rounded focus:outline-none focus:border-gold transition-colors"
              />
              <span className="text-xs text-muted">total points</span>
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-opacity w-fit ${
            canSubmit
              ? "bg-gold text-card hover:opacity-90 cursor-pointer"
              : "bg-card text-muted cursor-not-allowed border border-border"
          }`}
        >
          {submitting ? "Saving..." : "Save Final Four Picks"}
        </button>
      </div>
    </div>
  );
}

export default function RepickPage() {
  const { publicKey, disconnect } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [bracket, setBracket] = useState(null);
  const [myEntries, setMyEntries] = useState([]);
  const [donePicking, setDonePicking] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [holderLoading, setHolderLoading] = useState(false);
  const [midEvilCount, setMidEvilCount] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/bracket");
        if (!res.ok) throw new Error("failed");
        setBracket(await res.json());
      } catch {
        // bracket stays null
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setMidEvilCount(null);
      setMyEntries([]);
      return;
    }
    setHolderLoading(true);
    async function check() {
      try {
        const [count, eRes] = await Promise.all([
          checkMidEvilCount(walletAddress),
          fetch("/api/bracket/entries"),
        ]);
        setMidEvilCount(count);
        if (eRes.ok) {
          const data = await eRes.json();
          setMyEntries(
            (data.entries ?? []).filter((e) => e.walletAddress === walletAddress)
          );
        }
      } catch {
        setMidEvilCount(0);
      } finally {
        setHolderLoading(false);
      }
    }
    check();
  }, [walletAddress]);

  const handleDone = useCallback((id) => {
    setDonePicking((prev) => new Set([...prev, id]));
  }, []);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="animate-pulse h-8 w-64 bg-card rounded mb-8" />
      </div>
    );
  }

  // ── Repick closed ─────────────────────────────────────────────────────────
  if (!bracket?.ff_repick_open) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-4">Final Four Re-Pick</h1>
        <div className="bg-card border border-border rounded px-4 py-4 text-sm text-muted">
          The Final Four re-pick window is currently closed.
        </div>
        <div className="mt-4">
          <Link href="/bracket" className="text-sm text-gold hover:underline">Back to bracket</Link>
        </div>
      </div>
    );
  }

  // ── Wallet not connected ──────────────────────────────────────────────────
  if (!walletAddress) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-2">Final Four Re-Pick</h1>
        <p className="text-sm text-muted mb-6">
          The bracket orientation was corrected — re-pick your Final Four games before Apr 4 tipoff.
        </p>
        <div className="bg-card border border-border rounded px-4 py-6 text-sm text-muted max-w-sm">
          <p className="mb-4">Connect your wallet to re-pick.</p>
          <WalletMultiButton
            style={{
              backgroundColor: "#1a1a1a",
              color: "#f5f5f5",
              fontSize: "0.875rem",
              borderRadius: "9999px",
              padding: "0.5rem 1rem",
            }}
          />
        </div>
      </div>
    );
  }

  if (holderLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-4">Final Four Re-Pick</h1>
        <div className="text-sm text-muted">Verifying your MidEvils holdings...</div>
      </div>
    );
  }

  if (midEvilCount === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-4">Final Four Re-Pick</h1>
        <div className="bg-card border border-border rounded px-4 py-4 text-sm text-muted">
          No MidEvils found in this wallet.
        </div>
        <button onClick={disconnect} className="mt-3 text-sm text-gold hover:underline cursor-pointer">
          Try a different wallet ↩
        </button>
      </div>
    );
  }

  if (myEntries.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-4">Final Four Re-Pick</h1>
        <div className="bg-card border border-border rounded px-4 py-4 text-sm text-muted">
          No entries found for this wallet.
        </div>
        <div className="mt-4">
          <Link href="/bracket" className="text-sm text-gold hover:underline">Back to bracket</Link>
        </div>
      </div>
    );
  }

  const allDone = myEntries.every((e) => donePicking.has(e.id));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="font-blackletter text-3xl text-gold">Final Four Re-Pick</h1>
        <p className="text-sm text-muted mt-1">
          Re-submit your Final Four picks before the games tip off on April 4.
          Your earlier round picks are locked in — only the Final Four and Championship are re-opened.
        </p>
      </div>

      {/* Context callout */}
      <div className="mb-6 border border-amber-300/60 bg-amber-50/60 rounded px-4 py-3 text-xs text-amber-800 leading-relaxed">
        <p className="font-semibold mb-1">Why am I re-picking?</p>
        <p>
          The Final Four bracket matchups (East vs South, West vs Midwest) were corrected after picks were submitted.
          Your original FF picks were cleared. Re-pick below — only teams you correctly advanced to the Final Four
          can earn you points.
        </p>
      </div>

      {allDone ? (
        <div className="bg-card border border-border rounded px-4 py-4 text-sm text-foreground mb-6">
          ✓ All your entries have been updated. Good luck!
          <div className="mt-3 flex gap-4">
            {myEntries.map((e) => (
              <Link key={e.id} href={`/bracket/${e.id}`} className="text-gold hover:underline text-sm">
                View {e.username}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {myEntries.map((entry) =>
            donePicking.has(entry.id) ? (
              <div key={entry.id} className="bg-card border border-border rounded px-4 py-4 text-sm text-foreground flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Picks saved for <span className="text-gold font-medium">{entry.username}</span></span>
                <Link href={`/bracket/${entry.id}`} className="ml-auto text-xs text-gold hover:underline">
                  View entry →
                </Link>
              </div>
            ) : (
              <EntryRepickForm
                key={entry.id}
                entry={entry}
                bracket={bracket}
                onDone={handleDone}
              />
            )
          )}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-border">
        <Link href="/bracket" className="text-sm text-gold hover:underline">
          ← Back to bracket
        </Link>
      </div>
    </div>
  );
}
