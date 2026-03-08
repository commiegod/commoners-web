/**
 * POST /api/admin/bracket-reset-teams
 *
 * Clears all team names (and logos) from bracket-2026.json, leaving seeds and
 * IDs intact. Use before re-running the ESPN team sync to get a clean slate.
 */
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

  const { content: bracket, sha } = await getFile("data/bracket-2026.json");
  if (!bracket) {
    return NextResponse.json({ error: "Bracket not found" }, { status: 404 });
  }

  let cleared = 0;
  for (const region of Object.values(bracket.regions)) {
    for (const team of region.teams) {
      team.name = "";
      delete team.logoUrl;
      cleared++;
    }
  }

  await putFile(
    "data/bracket-2026.json",
    bracket,
    sha,
    "bracket: reset all team names"
  );

  return NextResponse.json({ ok: true, cleared });
}
