/**
 * ESPN unofficial API helpers for NCAA Tournament data.
 * Endpoints are undocumented and public — no API key required.
 */

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard";

const ROUND_PATTERNS = [
  { pattern: /First Four/i,                    round: "first_four" },
  { pattern: /1st Round|First Round/i,          round: "r1" },
  { pattern: /2nd Round|Second Round/i,         round: "r2" },
  { pattern: /Sweet 16|Sweet Sixteen/i,         round: "r3" },
  { pattern: /Elite Eight|Elite 8/i,            round: "r4" },
  { pattern: /Final Four/i,                     round: "ff" },
  { pattern: /National Championship|Championship/i, round: "champ" },
];

/**
 * Parse round and region from an ESPN event's competition notes.
 * Returns { round, region } or null if not a recognizable NCAA Tournament game.
 * Returns null for First Four games (not in our bracket structure).
 */
export function parseGameInfo(event) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  for (const note of comp.notes ?? []) {
    const h = note.headline ?? "";
    if (!h.includes("Men's Basketball Championship") && !h.includes("NCAA")) continue;

    let round = null;
    for (const { pattern, round: r } of ROUND_PATTERNS) {
      if (pattern.test(h)) { round = r; break; }
    }
    if (!round || round === "first_four") continue;

    let region = null;
    if (h.includes("East"))    region = "east";
    else if (h.includes("West"))    region = "west";
    else if (h.includes("South"))   region = "south";
    else if (h.includes("Midwest")) region = "midwest";

    return { round, region };
  }
  return null;
}

/**
 * Parse both competitors from an ESPN event.
 * Returns [{ name, seed, winner, score }, ...] or null.
 */
export function parseCompetitors(event) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  return comp.competitors.map((c) => ({
    name: c.team.displayName,
    seed: c.curatedRank?.current ?? null,
    winner: c.winner === true,
    score: parseInt(c.score, 10) || 0,
    logo: c.team.logo ?? null,
  }));
}

export function isCompleted(event) {
  return event.status?.type?.completed === true;
}

/**
 * Fetch all NCAA Tournament games (tournamentId=22) for a given year.
 * Queries the full tournament window (March 14 – April 8) in parallel.
 * Returns an array of unique ESPN event objects.
 */
export async function fetchTournamentGames(year) {
  // Build date strings for the full tournament window
  const dates = [];
  for (let d = 14; d <= 31; d++) dates.push(`${year}03${String(d).padStart(2, "0")}`);
  for (let d = 1;  d <= 8;  d++) dates.push(`${year}04${String(d).padStart(2, "0")}`);

  const dayResults = await Promise.all(
    dates.map(async (dateStr) => {
      try {
        const res = await fetch(
          `${SCOREBOARD_URL}?seasontype=3&dates=${dateStr}&limit=50`
        );
        if (!res.ok) return [];
        const json = await res.json();
        return json.events ?? [];
      } catch {
        return [];
      }
    })
  );

  // Flatten, dedupe by event ID, keep only recognizable tournament games
  const seen = new Set();
  const games = [];
  for (const dayEvents of dayResults) {
    for (const event of dayEvents) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      if (parseGameInfo(event) !== null) games.push(event);
    }
  }
  return games;
}
