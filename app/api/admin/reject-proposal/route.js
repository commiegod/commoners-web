import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../lib/githubApi";

export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    const { content: pending, sha } = await getFile(
      "data/pending-proposals.json"
    );
    const updated = (pending || []).filter((p) => p.id !== id);
    await putFile(
      "data/pending-proposals.json",
      updated,
      sha,
      `governance: reject proposal ${id}`
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reject-proposal error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
