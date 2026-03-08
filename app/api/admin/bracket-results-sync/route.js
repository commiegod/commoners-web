/**
 * POST /api/admin/bracket-results-sync
 *
 * Fetches all completed NCAA Tournament games from ESPN and updates
 * bracket-2026.json results. Safe to run at any point during the tournament —
 * only adds new results, never overwrites existing ones.
 */
import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../lib/githubApi";
import {
  fetchTournamentGames,
  parseGameInfo,
  parseCompetitors,
  isCompleted,
} from "../../../../lib/espnApi";

function authorized(request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  return token && token === process.env.ADMIN_SECRET;
}

// Seed matchup order — must match lib/bracket.js R1_MATCHUPS
const R1_MATCHUPS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];

/**
 * Given a winner's seed and round/region, return the bracket game ID.
 * Works for r1–r4. FF and champ are handled separately via name lookup.
 */
function seedToGameId(seed, round, region) {
  const r1Index = R1_MATCHUPS.findIndex(([a, b]) => a === seed || b === seed);
  if (r1Index === -1) return null;

  if (round === "r1") return `r1_${region}_${r1Index}`;

  const r2Index = Math.floor(r1Index / 2);
  if (round === "r2") return `r2_${region}_${r2Index}`;

  const r3Index = Math.floor(r2Index / 2);
  if (round === "r3") return `r3_${region}_${r3Index}`;

  if (round === "r4") return `r4_${region}`;

  return null;
}

function findTeamByName(bracket, name) {
  for (const [regionKey, region] of Object.entries(bracket.regions)) {
    const t = region.teams.find((t) => t.name === name);
    if (t) return { teamId: t.id, regionKey };
  }
  return null;
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = new Date().getFullYear();
  const allGames = await fetchTournamentGames(year);
  const completed = allGames.filter(isCompleted);

  if (completed.length === 0) {
    return NextResponse.json({ ok: true, message: "No completed games found yet.", updated: 0 });
  }

  const { content: bracket, sha } = await getFile("data/bracket-2026.json");
  if (!bracket) {
    return NextResponse.json({ error: "Bracket not found" }, { status: 404 });
  }

  const results = { ...(bracket.results ?? {}) };
  let updated = 0;
  const skipped = [];

  for (const game of completed) {
    const info = parseGameInfo(game);
    if (!info) continue;

    const competitors = parseCompetitors(game);
    if (!competitors) continue;

    const winner = competitors.find((c) => c.winner);
    if (!winner) continue;

    let gameId = null;
    let teamId = null;

    if (info.round === "r1" || info.round === "r2" || info.round === "r3" || info.round === "r4") {
      if (!info.region || !winner.seed) {
        skipped.push(`${info.round} game — missing region or seed`);
        continue;
      }
      gameId = seedToGameId(winner.seed, info.round, info.region);
      teamId = bracket.regions[info.region]?.teams.find((t) => t.seed === winner.seed)?.id;
    } else if (info.round === "ff") {
      // Look up winner by name to find their region → ff game index
      const found = findTeamByName(bracket, winner.name);
      if (!found) {
        skipped.push(`FF winner "${winner.name}" not found in bracket`);
        continue;
      }
      teamId = found.teamId;
      const pairs = bracket.ffPairings ?? [["east", "west"], ["south", "midwest"]];
      const ffIndex = pairs.findIndex((p) => p.includes(found.regionKey));
      gameId = ffIndex !== -1 ? `ff_${ffIndex}` : null;
    } else if (info.round === "champ") {
      const found = findTeamByName(bracket, winner.name);
      if (!found) {
        skipped.push(`Championship winner "${winner.name}" not found in bracket`);
        continue;
      }
      gameId = "champ";
      teamId = found.teamId;
    }

    if (!gameId || !teamId) {
      skipped.push(`Could not map game (round=${info.round}, region=${info.region}, winner=${winner.name})`);
      continue;
    }

    // Only update if not already set (avoid overwriting manual corrections)
    if (!results[gameId]) {
      results[gameId] = teamId;
      updated++;
    }
  }

  bracket.results = results;
  await putFile(
    "data/bracket-2026.json",
    bracket,
    sha,
    `bracket: ESPN results sync — ${updated} new results`
  );

  return NextResponse.json({ ok: true, updated, total: completed.length, skipped });
}
