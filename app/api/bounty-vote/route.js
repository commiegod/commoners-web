import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../lib/githubApi";
import { getCommonerCount } from "../../../lib/commoners";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  try {
    const { content } = await getFile("data/bounty-votes.json");
    const all = content || {};
    return NextResponse.json(
      date ? (all[date] ?? { tallies: {}, voters: {} }) : all
    );
  } catch {
    return NextResponse.json(date ? { tallies: {}, voters: {} } : {});
  }
}

export async function POST(request) {
  try {
    // allocations: { [submissionId]: number } — votes distributed across submissions
    const { date, allocations, walletAddress } = await request.json();

    if (!date || !allocations || !walletAddress || typeof allocations !== "object") {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const entries = Object.entries(allocations).filter(([, v]) => v > 0);
    if (entries.length === 0) {
      return NextResponse.json({ error: "Allocate at least 1 vote." }, { status: 400 });
    }
    if (!entries.every(([, v]) => Number.isInteger(v) && v >= 0)) {
      return NextResponse.json({ error: "Vote amounts must be non-negative integers." }, { status: 400 });
    }

    // Voting only open during today's live auction
    const today = new Date().toISOString().split("T")[0];
    if (date !== today) {
      return NextResponse.json({ error: "Voting is only open during the live auction." }, { status: 400 });
    }

    const weight = await getCommonerCount(walletAddress);
    if (weight === 0) {
      return NextResponse.json({ error: "You must hold a Commoner NFT to vote." }, { status: 403 });
    }

    const totalAllocated = entries.reduce((sum, [, v]) => sum + v, 0);
    if (totalAllocated > weight) {
      return NextResponse.json(
        { error: `Cannot allocate more than your ${weight} votes.` },
        { status: 400 }
      );
    }

    const { content, sha } = await getFile("data/bounty-votes.json");
    const all = content || {};
    if (!all[date]) all[date] = { tallies: {}, voters: {} };
    const day = all[date];

    if (day.voters[walletAddress]) {
      return NextResponse.json(
        { error: "You have already voted for today's submissions." },
        { status: 409 }
      );
    }

    // Verify all submission IDs exist in approved bounties
    const { content: bounties } = await getFile("data/bounties.json");
    const dayData = bounties?.[date];
    const allSubs = [...(dayData?.human ?? []), ...(dayData?.ai ?? [])];
    const validIds = new Set(allSubs.map((s) => s.id).filter(Boolean));
    for (const [subId] of entries) {
      if (!validIds.has(subId)) {
        return NextResponse.json({ error: `Submission not found: ${subId}` }, { status: 404 });
      }
    }

    for (const [subId, amount] of entries) {
      day.tallies[subId] = (day.tallies[subId] || 0) + amount;
    }
    day.voters[walletAddress] = { weight, allocations: Object.fromEntries(entries) };

    await putFile(
      "data/bounty-votes.json",
      all,
      sha,
      `vote: ${walletAddress.slice(0, 8)}… split ${totalAllocated}/${weight} votes`
    );

    return NextResponse.json({ ok: true, weight, tallies: day.tallies });
  } catch (err) {
    console.error("bounty-vote error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
