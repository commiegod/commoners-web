import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../lib/githubApi";

function authorized(request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  return token && token === process.env.ADMIN_SECRET;
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();

  // ── Read pending ────────────────────────────────────────────────────────────
  const { content: pendingList, sha: pendingSha } = await getFile(
    "data/pending-bounties.json"
  );
  const pending = pendingList || [];
  const submission = pending.find((s) => s.id === id);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  // ── Read bounties ───────────────────────────────────────────────────────────
  const { content: bountiesData, sha: bountiesSha } = await getFile(
    "data/bounties.json"
  );
  const bounties = bountiesData || {};

  // ── Add to appropriate bucket ───────────────────────────────────────────────
  if (!bounties[submission.date]) {
    bounties[submission.date] = { human: [], ai: [] };
  }
  const bucket = submission.type === "Human" ? "human" : "ai";
  bounties[submission.date][bucket].push({
    imageUrl: submission.imageUrl,
    artistName: submission.artistName,
    solanaAddress: submission.solanaAddress,
    twitter: submission.twitter || "",
    instagram: submission.instagram || "",
    website: submission.website || "",
  });

  // ── Write bounties first, then remove from pending ──────────────────────────
  await putFile(
    "data/bounties.json",
    bounties,
    bountiesSha,
    `bounty: approve ${submission.artistName} for ${submission.date}`
  );

  const newPending = pending.filter((s) => s.id !== id);
  await putFile(
    "data/pending-bounties.json",
    newPending,
    pendingSha,
    `bounty: remove approved submission ${id}`
  );

  return NextResponse.json({ ok: true });
}
