import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../../lib/githubApi";
import { scoreEntry, maxPossibleScore } from "../../../../../lib/bracket";
import { verifyWalletSignature } from "../../../../../lib/verifyWalletSignature";

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const [{ content: bracket }, { content: entriesData }] = await Promise.all([
      getFile("data/bracket-2026.json"),
      getFile("data/bracket-entries.json"),
    ]);

    const entries = entriesData?.entries ?? [];
    const results = bracket?.results ?? {};

    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Score all entries to compute rank
    const scored = entries.map((e) => ({
      id: e.id,
      score: scoreEntry(e.picks, results),
    }));
    scored.sort((a, b) => b.score - a.score);

    const rank = scored.findIndex((e) => e.id === id) + 1;
    const total = entries.length;

    return NextResponse.json({
      ...entry,
      score: scoreEntry(entry.picks, results),
      maxPossible: maxPossibleScore(entry.picks, results),
      rank,
      total,
    });
  } catch (err) {
    console.error("bracket entry GET error:", err);
    return NextResponse.json({ error: "Failed to load entry" }, { status: 500 });
  }
}

// FF re-pick: update only ff_0, ff_1, champ, tiebreaker for an existing entry
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { walletAddress, signature, signedMessage, ff_0, ff_1, champ, tiebreaker } = body ?? {};

    if (!walletAddress || !signature || !signedMessage) {
      return NextResponse.json({ error: "Wallet signature required" }, { status: 400 });
    }
    const sigResult = verifyWalletSignature(walletAddress, signedMessage, signature);
    if (!sigResult.ok) {
      return NextResponse.json({ error: sigResult.reason }, { status: 403 });
    }
    if (tiebreaker == null || !Number.isInteger(tiebreaker) || tiebreaker < 0) {
      return NextResponse.json({ error: "Tiebreaker must be a non-negative whole number" }, { status: 400 });
    }

    const [
      { content: bracket, sha: bracketSha },
      { content: entriesData, sha: entriesSha },
    ] = await Promise.all([
      getFile("data/bracket-2026.json"),
      getFile("data/bracket-entries.json"),
    ]);

    if (!bracket?.ff_repick_open) {
      return NextResponse.json({ error: "FF re-pick window is not open" }, { status: 403 });
    }

    const entries = entriesData?.entries ?? [];
    const entryIdx = entries.findIndex((e) => e.id === id);
    if (entryIdx === -1) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (entries[entryIdx].walletAddress !== walletAddress) {
      return NextResponse.json({ error: "This entry does not belong to your wallet" }, { status: 403 });
    }

    // Compute which FF teams this entry is eligible to pick
    // (must have correctly picked that team to win their region)
    const results = bracket.results ?? {};
    const ffPairings = bracket.ffPairings ?? [["east","south"],["west","midwest"]];
    const [ff0RegA, ff0RegB] = ffPairings[0];
    const [ff1RegA, ff1RegB] = ffPairings[1];
    const entryPicks = entries[entryIdx].picks ?? {};

    const ff0Eligible = new Set([
      entryPicks[`r4_${ff0RegA}`] === results[`r4_${ff0RegA}`] ? results[`r4_${ff0RegA}`] : null,
      entryPicks[`r4_${ff0RegB}`] === results[`r4_${ff0RegB}`] ? results[`r4_${ff0RegB}`] : null,
    ].filter(Boolean));

    const ff1Eligible = new Set([
      entryPicks[`r4_${ff1RegA}`] === results[`r4_${ff1RegA}`] ? results[`r4_${ff1RegA}`] : null,
      entryPicks[`r4_${ff1RegB}`] === results[`r4_${ff1RegB}`] ? results[`r4_${ff1RegB}`] : null,
    ].filter(Boolean));

    // Validate picks — null is allowed when the entry has no eligible team for that slot
    if (ff_0 != null && !ff0Eligible.has(ff_0)) {
      return NextResponse.json({ error: "ff_0 pick is not a team you had advancing to the Final Four" }, { status: 400 });
    }
    if (ff_0 == null && ff0Eligible.size > 0) {
      return NextResponse.json({ error: "ff_0 pick is required" }, { status: 400 });
    }
    if (ff_1 != null && !ff1Eligible.has(ff_1)) {
      return NextResponse.json({ error: "ff_1 pick is not a team you had advancing to the Final Four" }, { status: 400 });
    }
    if (ff_1 == null && ff1Eligible.size > 0) {
      return NextResponse.json({ error: "ff_1 pick is required" }, { status: 400 });
    }
    const champEligible = new Set([ff_0, ff_1].filter(Boolean));
    if (champ != null && !champEligible.has(champ)) {
      return NextResponse.json({ error: "champ pick must be your ff_0 or ff_1 winner pick" }, { status: 400 });
    }
    if (champ == null && champEligible.size > 0) {
      return NextResponse.json({ error: "champ pick is required" }, { status: 400 });
    }

    // Update the entry
    const updatedEntries = [...entries];
    updatedEntries[entryIdx] = {
      ...updatedEntries[entryIdx],
      picks: { ...updatedEntries[entryIdx].picks, ...(ff_0 ? { ff_0 } : {}), ...(ff_1 ? { ff_1 } : {}), ...(champ ? { champ } : {}) },
      tiebreaker,
      ffRepickAt: Date.now(),
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      let sha = attempt === 0 ? entriesSha : (await getFile("data/bracket-entries.json")).sha;
      try {
        await putFile(
          "data/bracket-entries.json",
          { entries: updatedEntries },
          sha,
          `bracket: ff repick for entry ${id}`
        );
        return NextResponse.json({ ok: true });
      } catch (writeErr) {
        if (!writeErr.message.includes(": 409")) throw writeErr;
      }
    }
    return NextResponse.json({ error: "Conflict — please try again" }, { status: 409 });
  } catch (err) {
    console.error("bracket entry PATCH error:", err);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}
