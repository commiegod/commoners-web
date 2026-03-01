import { NextResponse } from "next/server";
import { getFile } from "../../../../lib/githubApi";

// Returns active proposals whose voting window has closed — ready to finalize.
export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content } = await getFile("data/proposals.json");
  const now = new Date().toISOString();
  const ready = (content || []).filter(
    (p) => p.status === "active" && p.endsAt < now && p.chainId
  );
  return NextResponse.json(ready);
}
