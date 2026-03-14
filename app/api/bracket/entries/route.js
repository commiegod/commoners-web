import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../lib/githubApi";
import { scoreEntry, maxPossibleScore, tiebreakerDiff } from "../../../../lib/bracket";
import { getMidEvilCount } from "../../../../lib/serverChecks";
import { verifyWalletSignature } from "../../../../lib/verifyWalletSignature";

const ENTRY_LIMIT = 5;

function makeId() {
  return crypto.randomUUID();
}

// Substring match against lowercased username — extend as needed
const BLOCKED_TERMS = [
  "nigger","nigga","faggot","faget","fagot","chink","spic","spick","kike","wetback",
  "gook","tranny","retard","cunt","whore","slut","bitch","bastard","asshole","shithead",
  "motherfucker","cocksucker","fuckyou","fuckoff","dipshit","dumbass","jackass",
];

function isBlockedUsername(username) {
  const lower = username.toLowerCase().replace(/[^a-z0-9]/g, "");
  return BLOCKED_TERMS.some((term) => lower.includes(term));
}

function getAllTeamIds(bracket) {
  const ids = new Set();
  for (const region of Object.values(bracket.regions)) {
    for (const team of region.teams) {
      ids.add(team.id);
    }
  }
  return ids;
}

function computeRankedEntries(entries, results, championshipTotal) {
  const scored = entries.map((e) => ({
    ...e,
    score: scoreEntry(e.picks, results),
    maxPossible: maxPossibleScore(e.picks, results),
  }));
  scored.sort((a, b) =>
    b.score - a.score ||
    b.maxPossible - a.maxPossible ||
    tiebreakerDiff(a.tiebreaker ?? null, championshipTotal ?? null) -
    tiebreakerDiff(b.tiebreaker ?? null, championshipTotal ?? null)
  );
  return scored.map((e, idx) => ({ ...e, rank: idx + 1 }));
}


export async function GET() {
  try {
    const [{ content: bracket }, { content: entriesData }] = await Promise.all([
      getFile("data/bracket-2026.json"),
      getFile("data/bracket-entries.json"),
    ]);

    const entries = entriesData?.entries ?? [];
    const results = bracket?.results ?? {};
    const championshipTotal = bracket?.championshipScore
      ? bracket.championshipScore.winner + bracket.championshipScore.loser
      : null;

    const ranked = computeRankedEntries(entries, results, championshipTotal);
    return NextResponse.json({ entries: ranked });
  } catch (err) {
    console.error("bracket entries GET error:", err);
    return NextResponse.json({ error: "Failed to load entries" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { walletAddress, username, picks, signature, signedMessage, tiebreaker } = body ?? {};

    // ── Basic validation ────────────────────────────────────────────────────
    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }
    if (
      !username ||
      typeof username !== "string" ||
      username.trim().length < 1 ||
      username.trim().length > 30
    ) {
      return NextResponse.json(
        { error: "username must be 1–30 characters" },
        { status: 400 }
      );
    }
    if (isBlockedUsername(username.trim())) {
      return NextResponse.json(
        { error: "That username is not allowed." },
        { status: 400 }
      );
    }
    if (!picks || typeof picks !== "object" || Array.isArray(picks)) {
      return NextResponse.json({ error: "picks must be an object" }, { status: 400 });
    }
    if (Object.keys(picks).length !== 63) {
      return NextResponse.json(
        { error: `picks must have exactly 63 keys, got ${Object.keys(picks).length}` },
        { status: 400 }
      );
    }
    if (tiebreaker == null || !Number.isInteger(tiebreaker) || tiebreaker < 0) {
      return NextResponse.json(
        { error: "Tiebreaker must be a non-negative whole number (predicted combined score of the championship game)" },
        { status: 400 }
      );
    }

    // ── Verify wallet signature ─────────────────────────────────────────────
    if (!signature || !signedMessage) {
      return NextResponse.json(
        { error: "Wallet signature is required" },
        { status: 400 }
      );
    }
    const sigResult = verifyWalletSignature(walletAddress, signedMessage, signature);
    if (!sigResult.ok) {
      return NextResponse.json({ error: sigResult.reason }, { status: 403 });
    }

    // ── Load bracket + entries ───────────────────────────────────────────────
    const [
      { content: bracket, sha: bracketSha },
      { content: entriesData, sha: entriesSha },
    ] = await Promise.all([
      getFile("data/bracket-2026.json"),
      getFile("data/bracket-entries.json"),
    ]);

    if (!bracket) {
      return NextResponse.json({ error: "Bracket not found" }, { status: 404 });
    }

    // ── Check bracket status ────────────────────────────────────────────────
    if (bracket.status !== "open") {
      return NextResponse.json(
        { error: "Bracket entries are not open" },
        { status: 403 }
      );
    }

    // ── Check entry deadline ────────────────────────────────────────────────
    if (bracket.entryDeadline && Date.now() > new Date(bracket.entryDeadline).getTime()) {
      return NextResponse.json({ error: "Entry deadline has passed" }, { status: 403 });
    }

    // ── Check MidEvil holding ────────────────────────────────────────────────
    const midEvilCount = await getMidEvilCount(walletAddress);
    if (midEvilCount === 0) {
      return NextResponse.json(
        { error: "You must hold a MidEvils NFT to enter" },
        { status: 403 }
      );
    }

    // ── Check entry count (1 entry per MidEvil held, max 5) ─────────────────
    const entries = entriesData?.entries ?? [];
    const walletEntries = entries.filter((e) => e.walletAddress === walletAddress);
    const maxEntries = Math.min(midEvilCount, ENTRY_LIMIT);
    if (walletEntries.length >= maxEntries) {
      return NextResponse.json(
        {
          error: `You have used all ${maxEntries} ${maxEntries === 1 ? "entry" : "entries"} allowed for your ${midEvilCount} MidEvil${midEvilCount !== 1 ? "s" : ""}`,
        },
        { status: 403 }
      );
    }

    // ── Validate pick values are valid team IDs ──────────────────────────────
    const validTeamIds = getAllTeamIds(bracket);
    for (const [gameId, teamId] of Object.entries(picks)) {
      if (!validTeamIds.has(teamId)) {
        return NextResponse.json(
          { error: `Invalid team ID "${teamId}" for game "${gameId}"` },
          { status: 400 }
        );
      }
    }

    // ── Create entry ─────────────────────────────────────────────────────────
    const entry = {
      id: makeId(),
      walletAddress,
      username: username.trim(),
      picks,
      tiebreaker,
      submittedAt: Date.now(),
    };

    // Retry on SHA conflict from concurrent submissions
    let currentEntries = entries;
    let currentSha = entriesSha;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        // Re-fetch after conflict; re-check entry count with fresh data
        const fresh = await getFile("data/bracket-entries.json");
        currentEntries = fresh.content?.entries ?? [];
        currentSha = fresh.sha;
        const freshWalletEntries = currentEntries.filter((e) => e.walletAddress === walletAddress);
        if (freshWalletEntries.length >= maxEntries) {
          return NextResponse.json(
            { error: `You have used all ${maxEntries} ${maxEntries === 1 ? "entry" : "entries"} allowed for your ${midEvilCount} MidEvil${midEvilCount !== 1 ? "s" : ""}` },
            { status: 403 }
          );
        }
      }
      try {
        await putFile(
          "data/bracket-entries.json",
          { entries: [...currentEntries, entry] },
          currentSha,
          `bracket: new entry from ${username.trim()} (${walletAddress.slice(0, 8)})`
        );
        return NextResponse.json({ ok: true, id: entry.id });
      } catch (writeErr) {
        if (!writeErr.message.includes(": 409")) throw writeErr;
        // SHA conflict — retry with fresh data
      }
    }
    return NextResponse.json({ error: "Submission conflict — please try again" }, { status: 409 });
  } catch (err) {
    console.error("bracket entries POST error:", err);
    return NextResponse.json({ error: "Failed to submit entry" }, { status: 500 });
  }
}
