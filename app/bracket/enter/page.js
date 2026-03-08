"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

function buildChallengeMessage() {
  return `Submit bracket entry for MidEvils March Madness 2026.\nTimestamp: ${Date.now()}`;
}
import dynamic from "next/dynamic";
import Link from "next/link";
import BracketView from "../../components/BracketView";
import { allGameIds, getGameTeams, getTeamById } from "../../../lib/bracket";

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

/**
 * Given a set of picks and the game that just changed, clear any downstream
 * picks that are no longer reachable because a different team now advances.
 */
function cascadePicks(oldPicks, changedGameId, newTeamId, bracket) {
  const updated = { ...oldPicks, [changedGameId]: newTeamId };
  const gameIds = allGameIds(bracket);

  // For each game, check if the current pick is still a reachable team
  let changed = true;
  while (changed) {
    changed = false;
    for (const gameId of gameIds) {
      if (!updated[gameId]) continue;
      const { teamA, teamB } = getGameTeams(gameId, bracket, {}, updated);
      const reachable = new Set();
      if (teamA) reachable.add(teamA.id);
      if (teamB) reachable.add(teamB.id);
      if (updated[gameId] && !reachable.has(updated[gameId])) {
        delete updated[gameId];
        changed = true;
      }
    }
  }

  return updated;
}

export default function EnterBracketPage() {
  const { publicKey, signMessage } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [bracket, setBracket] = useState(null);
  const [myEntries, setMyEntries] = useState([]);
  const [midEvilCount, setMidEvilCount] = useState(null); // null = loading
  const [picks, setPicks] = useState({});
  const [username, setUsername] = useState("");
  const [tiebreaker, setTiebreaker] = useState("");
  const [loading, setLoading] = useState(true);
  const [holderLoading, setHolderLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // Load bracket
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/bracket");
        if (!res.ok) throw new Error("Failed to load bracket");
        const data = await res.json();
        setBracket(data);
      } catch {
        // bracket stays null
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Check holder status + existing entries when wallet connects
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
          const mine = (data.entries ?? []).filter(
            (e) => e.walletAddress === walletAddress
          );
          setMyEntries(mine);
        }
      } catch {
        setMidEvilCount(0);
      } finally {
        setHolderLoading(false);
      }
    }
    check();
  }, [walletAddress]);

  const handlePickChange = useCallback(
    (gameId, teamId) => {
      if (!bracket) return;
      setPicks((prev) => cascadePicks(prev, gameId, teamId, bracket));
    },
    [bracket]
  );

  const pickCount = Object.keys(picks).length;
  const tiebreakerVal = tiebreaker === "" ? null : parseInt(tiebreaker, 10);
  const tiebreakerValid = tiebreakerVal !== null && Number.isInteger(tiebreakerVal) && tiebreakerVal >= 0;
  const canSubmit =
    pickCount === 63 &&
    username.trim().length >= 1 &&
    username.trim().length <= 30 &&
    tiebreakerValid;

  async function handleSubmit() {
    if (!canSubmit || !walletAddress) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (!signMessage) {
        setSubmitError("Your wallet does not support message signing. Please use Phantom or Backpack.");
        setSubmitting(false);
        return;
      }
      const signedMessage = buildChallengeMessage();
      const msgBytes = new TextEncoder().encode(signedMessage);
      const signatureBytes = await signMessage(msgBytes);
      const signature = Buffer.from(signatureBytes).toString("base64");

      const res = await fetch("/api/bracket/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          username: username.trim(),
          picks,
          tiebreaker: tiebreakerVal,
          signature,
          signedMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Submission failed");
        return;
      }
      setSubmitSuccess(data.id);
      setPicks({});
      setUsername("");
      setTiebreaker("");
      setMyEntries((prev) => [
        ...prev,
        { id: data.id, username: username.trim(), picks, submittedAt: Date.now() },
      ]);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="animate-pulse h-8 w-64 bg-card rounded mb-8" />
        <div className="animate-pulse h-64 bg-card border border-border rounded" />
      </div>
    );
  }

  if (!bracket) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-4">
          MidEvils March Madness 2026
        </h1>
        <p className="text-muted">Failed to load bracket. Please try again.</p>
      </div>
    );
  }

  if (bracket.status !== "open") {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-4">
          MidEvils March Madness 2026
        </h1>
        <div className="bg-card border border-border rounded px-4 py-4 text-sm text-muted">
          {bracket.status === "pending"
            ? "Entry is not open yet. Check back after Selection Sunday."
            : bracket.status === "in_progress" || bracket.status === "complete"
            ? "Entry period has closed."
            : "Entry is not currently open."}
        </div>
        <div className="mt-4">
          <Link href="/bracket" className="text-sm text-gold hover:underline">
            Back to bracket
          </Link>
        </div>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-6">
          Enter Your Bracket
        </h1>
        <div className="bg-card border border-border rounded px-4 py-6 text-sm text-muted max-w-sm">
          <p className="mb-4">Connect your wallet to enter.</p>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-4">
          Enter Your Bracket
        </h1>
        <div className="text-sm text-muted">Verifying your MidEvils holdings...</div>
      </div>
    );
  }

  if (midEvilCount === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-4">
          Enter Your Bracket
        </h1>
        <div className="bg-card border border-border rounded px-4 py-4 text-sm text-muted">
          You must hold a MidEvils NFT to enter. This wallet holds no MidEvils.
        </div>
        <div className="mt-4">
          <Link href="/bracket" className="text-sm text-gold hover:underline">
            Back to bracket
          </Link>
        </div>
      </div>
    );
  }

  const maxEntries = Math.min(midEvilCount ?? 0, 5);

  if (myEntries.length >= maxEntries) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-4">
          Enter Your Bracket
        </h1>
        <div className="bg-card border border-border rounded px-4 py-4 text-sm text-muted">
          You have used all {maxEntries} {maxEntries === 1 ? "entry" : "entries"} allowed for your {midEvilCount} MidEvil{midEvilCount !== 1 ? "s" : ""}.
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {myEntries.map((e) => (
            <Link
              key={e.id}
              href={`/bracket/${e.id}`}
              className="text-sm text-gold hover:underline"
            >
              {e.username}
            </Link>
          ))}
          <Link href="/bracket" className="text-sm text-gold hover:underline mt-2">
            Back to bracket
          </Link>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-blackletter text-3xl text-gold mb-4">
          Entry Submitted
        </h1>
        <div className="bg-card border border-border rounded px-4 py-4 text-sm text-foreground mb-4">
          Your bracket has been submitted.
        </div>
        <div className="flex gap-4 text-sm">
          <Link href={`/bracket/${submitSuccess}`} className="text-gold hover:underline">
            View your entry
          </Link>
          <Link href="/bracket" className="text-gold hover:underline">
            Back to bracket
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="font-blackletter text-3xl text-gold">Enter Your Bracket</h1>
        <p className="text-sm text-muted mt-1">
          Entry {myEntries.length + 1} of {maxEntries} — {midEvilCount} MidEvil
          {midEvilCount !== 1 ? "s" : ""} held
        </p>
      </div>

      {/* Bracket name input */}
      <div className="mb-6 max-w-sm">
        <label className="block text-xs text-muted uppercase tracking-widest mb-1.5">
          Bracket Name
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="My bracket"
          maxLength={30}
          className="w-full border border-border bg-background text-foreground text-sm px-3 py-2 rounded focus:outline-none focus:border-gold transition-colors"
        />
        <p className="text-xs text-muted/60 mt-1">{username.trim().length} / 30</p>
      </div>

      {/* Instruction banner */}
      <div className="mb-4 bg-card border border-border rounded px-3 py-2 text-xs text-muted">
        Click a team name to pick them to advance. Picks cascade automatically — changing an early round clears later picks that are no longer reachable.
      </div>

      {/* Pick progress */}
      <div className="mb-4 flex items-center gap-4">
        <div className="text-sm text-muted">
          <span className={pickCount === 63 ? "text-green-600 font-semibold" : "text-foreground"}>
            {pickCount}
          </span>
          <span className="text-muted"> / 63 picks made</span>
        </div>
        {pickCount < 63 && (
          <div className="flex-1 bg-card border border-border rounded-full h-1.5 max-w-xs">
            <div
              className="bg-gold h-1.5 rounded-full transition-all"
              style={{ width: `${(pickCount / 63) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Bracket picker */}
      <div className="border border-border rounded overflow-hidden bg-background mb-6">
        <BracketView
          bracket={bracket}
          results={{}}
          picks={picks}
          onPickChange={handlePickChange}
          mode="pick"
        />
      </div>

      {/* Tiebreaker */}
      {pickCount === 63 && (() => {
        const { teamA, teamB } = getGameTeams("champ", bracket, {}, picks);
        return (
          <div className="mb-6 max-w-sm border border-gold/30 rounded bg-card px-4 py-4">
            <p className="text-xs text-gold uppercase tracking-widest mb-1">Tiebreaker</p>
            <p className="text-sm text-foreground font-medium mb-0.5">
              {teamA && teamB
                ? `${teamA.name} vs. ${teamB.name}`
                : "Championship Game"}
            </p>
            <p className="text-xs text-muted mb-3">
              Predict the combined total score. Used to break ties if two brackets finish with the same points.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={tiebreaker}
                onChange={(e) => setTiebreaker(e.target.value)}
                placeholder="e.g. 145"
                className="w-32 border border-border bg-background text-foreground text-sm px-3 py-2 rounded focus:outline-none focus:border-gold transition-colors"
              />
              <span className="text-xs text-muted">total points</span>
            </div>
          </div>
        );
      })()}

      {/* Submit */}
      {submitError && (
        <p className="text-red-500 text-sm mb-3">{submitError}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-opacity ${
          canSubmit && !submitting
            ? "bg-gold text-card hover:opacity-90 cursor-pointer"
            : "bg-card text-muted cursor-not-allowed border border-border"
        }`}
      >
        {submitting ? "Submitting..." : "Submit Bracket"}
      </button>

      {!canSubmit && pickCount < 63 && (
        <p className="text-xs text-muted mt-2">
          Complete all 63 picks to submit.
        </p>
      )}

      {/* Previous entries */}
      {myEntries.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-xs text-muted uppercase tracking-widest mb-2">
            Your Entries
          </h2>
          <div className="flex flex-col gap-2">
            {myEntries.map((e) => (
              <Link
                key={e.id}
                href={`/bracket/${e.id}`}
                className="text-sm text-gold hover:underline"
              >
                {e.username}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
