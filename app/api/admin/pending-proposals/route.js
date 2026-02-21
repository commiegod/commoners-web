import { NextResponse } from "next/server";
import { getFile } from "../../../../lib/githubApi";

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { content } = await getFile("data/pending-proposals.json");
    return NextResponse.json(content || []);
  } catch (err) {
    console.error("pending-proposals error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
