import { NextResponse } from "next/server";
import { getFile } from "../../../lib/githubApi";

export async function GET() {
  try {
    const [{ content: proposals }, { content: votes }] = await Promise.all([
      getFile("data/proposals.json"),
      getFile("data/governance-votes.json").catch(() => ({ content: {} })),
    ]);

    const list = (proposals || []).map((p) => {
      const onChainVotes = votes?.[p.id];
      return {
        id: p.id,
        chainId: p.chainId ?? null,
        type: p.type,
        title: p.title,
        description: p.description,
        treasurySol: p.treasurySol ?? 0,
        proposedBy: p.proposedBy,
        status: p.status,
        endsAt: p.endsAt,
        finalizedAt: p.finalizedAt ?? null,
        votes: onChainVotes?.tallies ?? p.votes ?? { yes: 0, no: 0, abstain: 0 },
        imageUrl: p.imageUrl ?? null,
      };
    });

    return NextResponse.json(list, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("proposals route error:", err);
    return NextResponse.json({ error: "Failed to load proposals." }, { status: 500 });
  }
}
