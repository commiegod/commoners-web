/**
 * POST /api/admin/bracket-sync
 *
 * Fetches R1 NCAA Tournament games from ESPN after Selection Sunday and
 * populates all 64 team names + seeds into bracket-2026.json.
 * Run once after the bracket is announced.
 */
import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../lib/githubApi";
import { fetchTournamentGames, parseGameInfo, parseCompetitors } from "../../../../lib/espnApi";

function authorized(request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  return token && token === process.env.ADMIN_SECRET;
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = new Date().getFullYear();
  const allGames = await fetchTournamentGames(year);
  const r1Games = allGames.filter((g) => parseGameInfo(g)?.round === "r1");

  if (r1Games.length === 0) {
    return NextResponse.json(
      { error: `No R1 tournament games found for ${year}. The bracket may not be announced yet — check back after Selection Sunday.` },
      { status: 404 }
    );
  }

  // Build seed → { name, logo } map per region from R1 matchups
  const regionSeeds = { east: {}, west: {}, south: {}, midwest: {} };

  for (const game of r1Games) {
    const info = parseGameInfo(game);
    if (!info?.region) continue;
    const competitors = parseCompetitors(game);
    if (!competitors) continue;

    for (const c of competitors) {
      if (c.seed >= 1 && c.seed <= 16) {
        regionSeeds[info.region][c.seed] = { name: c.name, logo: c.logo };
      }
    }
  }

  const totalFound = Object.values(regionSeeds).reduce(
    (sum, m) => sum + Object.keys(m).length,
    0
  );

  if (totalFound < 32) {
    return NextResponse.json(
      { error: `Only found ${totalFound} teams — bracket may be incomplete. Try again once R1 games are fully scheduled.` },
      { status: 422 }
    );
  }

  // Update bracket-2026.json in place
  const { content: bracket, sha } = await getFile("data/bracket-2026.json");
  if (!bracket) {
    return NextResponse.json({ error: "Bracket not found" }, { status: 404 });
  }

  let updated = 0;
  for (const [regionKey, seedMap] of Object.entries(regionSeeds)) {
    if (!bracket.regions[regionKey]) continue;
    for (const [seedStr, { name, logo }] of Object.entries(seedMap)) {
      const seed = parseInt(seedStr, 10);
      const team = bracket.regions[regionKey].teams.find((t) => t.seed === seed);
      if (team && team.name !== name) {
        team.name = name;
        if (logo) team.logoUrl = logo;
        updated++;
      }
    }
  }

  await putFile(
    "data/bracket-2026.json",
    bracket,
    sha,
    `bracket: ESPN team sync — ${totalFound} teams, ${updated} updated`
  );

  return NextResponse.json({ ok: true, teamsFound: totalFound, updated });
}
