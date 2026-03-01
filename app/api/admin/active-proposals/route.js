import { NextResponse } from "next/server";
import { getFile } from "../../../../lib/githubApi";
import { getConnection, fetchProposalAccount } from "../../../../lib/programClient";

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content } = await getFile("data/proposals.json");
  const active = (content || []).filter(
    (p) => p.status === "active" && p.chainId
  );

  // Enrich each proposal with live on-chain vote tallies
  const conn = getConnection();
  const enriched = await Promise.all(
    active.map(async (p) => {
      try {
        const result = await fetchProposalAccount(conn, BigInt(p.chainId));
        if (result) {
          return {
            ...p,
            votes: {
              yes: result.state.yes.toNumber(),
              no: result.state.no.toNumber(),
              abstain: result.state.abstain.toNumber(),
            },
          };
        }
      } catch {}
      return p;
    })
  );

  return NextResponse.json(enriched);
}
