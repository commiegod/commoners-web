import { NextResponse } from "next/server";
import { getFile } from "../../../../lib/githubApi";

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const { content } = await getFile("data/proposals.json");
    const proposals = content || [];
    const proposal = proposals.find((p) => p.id === id);
    if (!proposal) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Attach sequential number (1-based index in the array)
    const proposalNumber = proposals.indexOf(proposal) + 1;
    return NextResponse.json({ ...proposal, proposalNumber });
  } catch (err) {
    console.error("proposals/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
