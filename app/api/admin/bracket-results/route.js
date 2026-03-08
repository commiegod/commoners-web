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

  try {
    const body = await request.json();
    const { results, status, entryDeadline, teams, championshipScore } = body ?? {};

    const { content: bracket, sha } = await getFile("data/bracket-2026.json");
    if (!bracket) {
      return NextResponse.json({ error: "Bracket not found" }, { status: 404 });
    }

    // Merge results (partial update)
    if (results && typeof results === "object") {
      bracket.results = { ...(bracket.results ?? {}), ...results };
    }

    // Update status
    if (status !== undefined) {
      const validStatuses = ["pending", "open", "in_progress", "complete"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      bracket.status = status;
    }

    // Update entry deadline
    if (entryDeadline !== undefined) {
      if (entryDeadline === null) {
        bracket.entryDeadline = null;
      } else {
        const d = new Date(entryDeadline);
        if (isNaN(d.getTime())) {
          return NextResponse.json({ error: "Invalid entryDeadline" }, { status: 400 });
        }
        bracket.entryDeadline = d.toISOString();
      }
    }

    // Update region teams (for when the bracket field is released)
    if (teams && typeof teams === "object") {
      for (const [regionKey, regionTeams] of Object.entries(teams)) {
        if (!bracket.regions[regionKey]) {
          return NextResponse.json(
            { error: `Unknown region: ${regionKey}` },
            { status: 400 }
          );
        }
        if (!Array.isArray(regionTeams)) continue;
        for (const teamUpdate of regionTeams) {
          const existing = bracket.regions[regionKey].teams.find(
            (t) => t.seed === teamUpdate.seed
          );
          if (existing && teamUpdate.name) {
            existing.name = teamUpdate.name;
          }
        }
      }
    }

    // Update championship score (for tiebreaker)
    if (championshipScore && typeof championshipScore === "object") {
      const w = parseInt(championshipScore.winner, 10);
      const l = parseInt(championshipScore.loser, 10);
      if (!isNaN(w) && !isNaN(l) && w >= 0 && l >= 0) {
        bracket.championshipScore = { winner: w, loser: l };
      }
    }

    await putFile(
      "data/bracket-2026.json",
      bracket,
      sha,
      "bracket: admin update results/status"
    );

    return NextResponse.json({ ok: true, bracket });
  } catch (err) {
    console.error("bracket-results POST error:", err);
    return NextResponse.json({ error: "Failed to update bracket" }, { status: 500 });
  }
}
