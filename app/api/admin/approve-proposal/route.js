import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../lib/githubApi";

export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await request.json();

    const { content: pending, sha: pendingSha } = await getFile(
      "data/pending-proposals.json"
    );
    const submission = (pending || []).find((p) => p.id === id);
    if (!submission) {
      return NextResponse.json(
        { error: "Proposal not found." },
        { status: 404 }
      );
    }

    // Build active proposal with 72-hour window starting now
    const endsAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const proposal = {
      id: submission.id,
      type: submission.type,
      title: submission.title,
      description: submission.description,
      treasurySol: submission.treasurySol || 0,
      proposedBy: submission.proposedBy,
      status: "active",
      endsAt,
      votes: { yes: 0, no: 0, abstain: 0 },
    };

    // Add to proposals.json
    const { content: proposals, sha: proposalsSha } = await getFile(
      "data/proposals.json"
    );
    await putFile(
      "data/proposals.json",
      [...(proposals || []), proposal],
      proposalsSha,
      `governance: approve proposal "${submission.title}"`
    );

    // Remove from pending
    const updatedPending = (pending || []).filter((p) => p.id !== id);
    await putFile(
      "data/pending-proposals.json",
      updatedPending,
      pendingSha,
      `governance: clear approved proposal ${id}`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("approve-proposal error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
