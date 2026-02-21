import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../lib/githubApi";
import { getCommonerCount } from "../../../lib/commoners";

export async function GET() {
  try {
    const { content } = await getFile("data/governance-votes.json");
    return NextResponse.json(content || {});
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(request) {
  try {
    const { proposalId, choice, walletAddress } = await request.json();

    if (!proposalId || !choice || !walletAddress) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (!["yes", "no", "abstain"].includes(choice)) {
      return NextResponse.json(
        { error: "Invalid vote choice." },
        { status: 400 }
      );
    }

    const weight = await getCommonerCount(walletAddress);
    if (weight === 0) {
      return NextResponse.json(
        { error: "You must hold a Commoner NFT to vote." },
        { status: 403 }
      );
    }

    const { content, sha } = await getFile("data/governance-votes.json");
    const all = content || {};

    if (!all[proposalId]) {
      all[proposalId] = { tallies: { yes: 0, no: 0, abstain: 0 }, voters: {} };
    }
    const prop = all[proposalId];

    if (prop.voters[walletAddress]) {
      return NextResponse.json(
        { error: "You have already voted on this proposal." },
        { status: 409 }
      );
    }

    prop.tallies[choice] = (prop.tallies[choice] || 0) + weight;
    prop.voters[walletAddress] = { weight, choice };

    await putFile(
      "data/governance-votes.json",
      all,
      sha,
      `vote: ${walletAddress.slice(0, 8)}… → ${choice} on ${proposalId} (×${weight})`
    );

    return NextResponse.json({ ok: true, weight, tallies: prop.tallies });
  } catch (err) {
    console.error("governance-vote error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
