import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../lib/githubApi";
import { scoreEntry, maxPossibleScore } from "../../../../lib/bracket";
import { getMidEvilCount } from "../../../../lib/midevils";
import { ed25519 } from "@noble/curves/ed25519";
import { PublicKey } from "@solana/web3.js";

const SIGNATURE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
const ENTRY_LIMIT = 5;

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

function computeRankedEntries(entries, results) {
  const scored = entries.map((e) => ({
    ...e,
    score: scoreEntry(e.picks, results),
    maxPossible: maxPossibleScore(e.picks, results),
  }));
  scored.sort((a, b) => b.score - a.score || b.maxPossible - a.maxPossible);
  return scored.map((e, idx) => ({ ...e, rank: idx + 1 }));
}

/**
 * Verify the signed challenge message.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
function verifySignature(walletAddress, signedMessage, signature) {
  try {
    // Parse timestamp from message: last line "Timestamp: <ms>"
    const match = signedMessage.match(/Timestamp:\s*(\d+)/);
    if (!match) return { ok: false, reason: "Invalid challenge message format" };
    const ts = parseInt(match[1], 10);
    if (isNaN(ts)) return { ok: false, reason: "Invalid timestamp in challenge" };
    if (Date.now() - ts > SIGNATURE_MAX_AGE_MS) {
      return { ok: false, reason: "Challenge message expired — please try again" };
    }

    const msgBytes = new TextEncoder().encode(signedMessage);
    const sigBytes = Buffer.from(signature, "base64");
    const pubKeyBytes = new PublicKey(walletAddress).toBytes();

    const valid = ed25519.verify(sigBytes, msgBytes, pubKeyBytes);
    if (!valid) return { ok: false, reason: "Signature verification failed" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Signature verification error" };
  }
}

export async function GET() {
  try {
    const [{ content: bracket }, { content: entriesData }] = await Promise.all([
      getFile("data/bracket-2026.json"),
      getFile("data/bracket-entries.json"),
    ]);

    const entries = entriesData?.entries ?? [];
    const results = bracket?.results ?? {};

    const ranked = computeRankedEntries(entries, results);
    return NextResponse.json({ entries: ranked });
  } catch (err) {
    console.error("bracket entries GET error:", err);
    return NextResponse.json({ error: "Failed to load entries" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { walletAddress, username, picks, signature, signedMessage } = body ?? {};

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
    if (!picks || typeof picks !== "object" || Array.isArray(picks)) {
      return NextResponse.json({ error: "picks must be an object" }, { status: 400 });
    }
    if (Object.keys(picks).length !== 63) {
      return NextResponse.json(
        { error: `picks must have exactly 63 keys, got ${Object.keys(picks).length}` },
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
    const sigResult = verifySignature(walletAddress, signedMessage, signature);
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
      submittedAt: Date.now(),
    };

    const updatedEntries = { entries: [...entries, entry] };
    await putFile(
      "data/bracket-entries.json",
      updatedEntries,
      entriesSha,
      `bracket: new entry from ${username.trim()} (${walletAddress.slice(0, 8)})`
    );

    return NextResponse.json({ ok: true, id: entry.id });
  } catch (err) {
    console.error("bracket entries POST error:", err);
    return NextResponse.json({ error: "Failed to submit entry" }, { status: 500 });
  }
}
