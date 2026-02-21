import { NextResponse } from "next/server";
import { getFile } from "../../../../lib/githubApi";

function authorized(request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  return token && token === process.env.ADMIN_SECRET;
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { content } = await getFile("data/pending-bounties.json");
  return NextResponse.json(content || []);
}
