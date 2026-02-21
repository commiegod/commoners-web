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
    const { date, submissionId, walletAddress } = await request.json();

    if (!date || !submissionId || !walletAddress) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Voting only open during today's live auction
    const today = new Date().toISOString().split("T")[0];
    if (date !== today) {
      return NextResponse.json(
        { error: "Voting is only open during the live auction." },
        { status: 400 }
      );
    }

    // Vote weight = number of Commoner NFTs held
    const weight = await getCommonerCount(walletAddress);
    if (weight === 0) {
      return NextResponse.json(
        { error: "You must hold a Commoner NFT to vote." },
        { status: 403 }
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

    // Verify the submission exists in approved bounties
    const { content: bounties } = await getFile("data/bounties.json");
    const dayData = bounties?.[date];
    const allSubs = [...(dayData?.human ?? []), ...(dayData?.ai ?? [])];
    if (!allSubs.find((s) => s.id === submissionId)) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 }
      );
    }

    day.tallies[submissionId] = (day.tallies[submissionId] || 0) + weight;
    day.voters[walletAddress] = { weight, votedFor: submissionId };

    await putFile(
      "data/bounty-votes.json",
      all,
      sha,
      `vote: ${walletAddress.slice(0, 8)}… → ${submissionId} (×${weight})`
    );

    return NextResponse.json({
      ok: true,
      weight,
      newTotal: day.tallies[submissionId],
    });
  } catch (err) {
    console.error("bounty-vote error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
