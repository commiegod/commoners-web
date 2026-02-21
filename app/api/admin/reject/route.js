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

  const { content: pendingList, sha } = await getFile(
    "data/pending-bounties.json"
  );
  const pending = pendingList || [];
  const newPending = pending.filter((s) => s.id !== id);

  if (newPending.length === pending.length) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  await putFile(
    "data/pending-bounties.json",
    newPending,
    sha,
    `bounty: reject submission ${id}`
  );

  return NextResponse.json({ ok: true });
}
