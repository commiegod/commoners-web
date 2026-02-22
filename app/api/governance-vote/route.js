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
    // allocations: { yes: N, no: M, abstain: P } — votes split across choices
    const { proposalId, allocations, walletAddress } = await request.json();

    if (!proposalId || !allocations || !walletAddress || typeof allocations !== "object") {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const { yes = 0, no = 0, abstain = 0 } = allocations;
    if (
      !Number.isInteger(yes) || yes < 0 ||
      !Number.isInteger(no) || no < 0 ||
      !Number.isInteger(abstain) || abstain < 0
    ) {
      return NextResponse.json({ error: "Vote amounts must be non-negative integers." }, { status: 400 });
    }

    const totalAllocated = yes + no + abstain;
    if (totalAllocated === 0) {
      return NextResponse.json({ error: "Allocate at least 1 vote." }, { status: 400 });
    }

    const weight = await getCommonerCount(walletAddress);
    if (weight === 0) {
      return NextResponse.json({ error: "You must hold a Commoner NFT to vote." }, { status: 403 });
    }

    if (totalAllocated > weight) {
      return NextResponse.json(
        { error: `Cannot allocate more than your ${weight} votes.` },
        { status: 400 }
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

    prop.tallies.yes = (prop.tallies.yes || 0) + yes;
    prop.tallies.no = (prop.tallies.no || 0) + no;
    prop.tallies.abstain = (prop.tallies.abstain || 0) + abstain;
    prop.voters[walletAddress] = { weight, allocations: { yes, no, abstain } };

    await putFile(
      "data/governance-votes.json",
      all,
      sha,
      `vote: ${walletAddress.slice(0, 8)}… split ${totalAllocated}/${weight} on ${proposalId}`
    );

    return NextResponse.json({ ok: true, weight, tallies: prop.tallies });
  } catch (err) {
    console.error("governance-vote error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
