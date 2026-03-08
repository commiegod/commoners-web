/**
 * Pure utility functions for March Madness bracket logic.
 * No React, no side effects — safe to import in both client and server contexts.
 */

// Round of 64 seed matchup order within each region.
// Index = game index (0-7), values = [topSeed, bottomSeed]
export const R1_MATCHUPS = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

/**
 * Map gameId prefix → round number (for scoring).
 * @param {string} gameId
 * @returns {number}
 */
export function getRound(gameId) {
  if (gameId.startsWith("r1_")) return 1;
  if (gameId.startsWith("r2_")) return 2;
  if (gameId.startsWith("r3_")) return 3;
  if (gameId.startsWith("r4_")) return 4;
  if (gameId.startsWith("ff_")) return 5;
  if (gameId === "champ") return 6;
  return 0;
}

// ESPN-style scoring: 10,20,40,80,160,320 per round
export const ROUND_POINTS = { 1: 10, 2: 20, 3: 40, 4: 80, 5: 160, 6: 320 };
export const MAX_SCORE = 1920;

/**
 * Return all 63 gameIds in bracket order.
 * @param {object} bracket
 * @returns {string[]}
 */
export function allGameIds(bracket) {
  const ids = [];
  const regionKeys = Object.keys(bracket.regions);

  // R1–R4 for each region
  for (const region of regionKeys) {
    for (let i = 0; i < 8; i++) ids.push(`r1_${region}_${i}`);
    for (let i = 0; i < 4; i++) ids.push(`r2_${region}_${i}`);
    for (let i = 0; i < 2; i++) ids.push(`r3_${region}_${i}`);
    ids.push(`r4_${region}`);
  }

  // Final Four + Championship
  const pairs = bracket.ffPairings ?? [];
  for (let i = 0; i < pairs.length; i++) {
    ids.push(`ff_${i}`);
  }
  ids.push("champ");

  return ids;
}

/**
 * Score one entry against official results.
 * @param {object} picks  { [gameId]: teamId }
 * @param {object} results { [gameId]: teamId }
 * @returns {number}
 */
export function scoreEntry(picks, results) {
  let score = 0;
  for (const [gameId, pick] of Object.entries(picks)) {
    if (results[gameId] && results[gameId] === pick) {
      score += ROUND_POINTS[getRound(gameId)] ?? 0;
    }
  }
  return score;
}

/**
 * Maximum possible score remaining (already earned + all undecided picks still correct).
 * @param {object} picks
 * @param {object} results
 * @returns {number}
 */
export function maxPossibleScore(picks, results) {
  let score = scoreEntry(picks, results);
  for (const [gameId, pick] of Object.entries(picks)) {
    if (!results[gameId] && pick) {
      score += ROUND_POINTS[getRound(gameId)] ?? 0;
    }
  }
  return score;
}

/**
 * Look up a team object by its ID from any region.
 * @param {object} bracket
 * @param {string} teamId
 * @returns {{ id, seed, name } | null}
 */
export function getTeamById(bracket, teamId) {
  if (!teamId) return null;
  for (const region of Object.values(bracket.regions)) {
    const t = region.teams.find((t) => t.id === teamId);
    if (t) return t;
  }
  return null;
}

/**
 * Resolve the winner of a predecessor game: results first, then picks, else null.
 * @param {string} predGameId
 * @param {object} results
 * @param {object} picks
 * @returns {string | null}  teamId or null
 */
function resolveWinner(predGameId, results, picks) {
  if (results[predGameId]) return results[predGameId];
  if (picks[predGameId]) return picks[predGameId];
  return null;
}

/**
 * Compute which two teams appear in any game slot, by traversing the bracket tree.
 *
 * For r1 games: read directly from bracket.regions (seed-ordered matchups).
 * For r2–r4 games: look up winners of predecessor games from results/picks.
 * For ff/champ games: same traversal across regions.
 *
 * @param {string} gameId
 * @param {object} bracket
 * @param {object} [results]
 * @param {object} [picks]
 * @returns {{ teamA: {id,seed,name}|null, teamB: {id,seed,name}|null }}
 */
export function getGameTeams(gameId, bracket, results = {}, picks = {}) {
  // ── Round 1: read directly from region teams ──────────────────────────────
  if (gameId.startsWith("r1_")) {
    // r1_{region}_{i}
    const parts = gameId.split("_");
    const region = parts[1];
    const i = parseInt(parts[2], 10);
    const [seedA, seedB] = R1_MATCHUPS[i] ?? [null, null];
    const regionData = bracket.regions[region];
    if (!regionData) return { teamA: null, teamB: null };
    const teamA = regionData.teams.find((t) => t.seed === seedA) ?? null;
    const teamB = regionData.teams.find((t) => t.seed === seedB) ?? null;
    return { teamA, teamB };
  }

  // ── Round 2: winners of r1 pairs ─────────────────────────────────────────
  if (gameId.startsWith("r2_")) {
    // r2_{region}_{i}
    const parts = gameId.split("_");
    const region = parts[1];
    const i = parseInt(parts[2], 10);
    const predA = `r1_${region}_${2 * i}`;
    const predB = `r1_${region}_${2 * i + 1}`;
    const winA = resolveWinner(predA, results, picks);
    const winB = resolveWinner(predB, results, picks);
    return {
      teamA: getTeamById(bracket, winA),
      teamB: getTeamById(bracket, winB),
    };
  }

  // ── Round 3 (Sweet 16): winners of r2 pairs ───────────────────────────────
  if (gameId.startsWith("r3_")) {
    // r3_{region}_{i}
    const parts = gameId.split("_");
    const region = parts[1];
    const i = parseInt(parts[2], 10);
    const predA = `r2_${region}_${2 * i}`;
    const predB = `r2_${region}_${2 * i + 1}`;
    const winA = resolveWinner(predA, results, picks);
    const winB = resolveWinner(predB, results, picks);
    return {
      teamA: getTeamById(bracket, winA),
      teamB: getTeamById(bracket, winB),
    };
  }

  // ── Round 4 (Elite 8): winner of r3_0 vs r3_1 ────────────────────────────
  if (gameId.startsWith("r4_")) {
    // r4_{region}
    const region = gameId.slice(3);
    const predA = `r3_${region}_0`;
    const predB = `r3_${region}_1`;
    const winA = resolveWinner(predA, results, picks);
    const winB = resolveWinner(predB, results, picks);
    return {
      teamA: getTeamById(bracket, winA),
      teamB: getTeamById(bracket, winB),
    };
  }

  // ── Final Four ────────────────────────────────────────────────────────────
  if (gameId.startsWith("ff_")) {
    const ffIndex = parseInt(gameId.slice(3), 10);
    const pair = bracket.ffPairings?.[ffIndex];
    if (!pair) return { teamA: null, teamB: null };
    const predA = `r4_${pair[0]}`;
    const predB = `r4_${pair[1]}`;
    const winA = resolveWinner(predA, results, picks);
    const winB = resolveWinner(predB, results, picks);
    return {
      teamA: getTeamById(bracket, winA),
      teamB: getTeamById(bracket, winB),
    };
  }

  // ── Championship ──────────────────────────────────────────────────────────
  if (gameId === "champ") {
    const winA = resolveWinner("ff_0", results, picks);
    const winB = resolveWinner("ff_1", results, picks);
    return {
      teamA: getTeamById(bracket, winA),
      teamB: getTeamById(bracket, winB),
    };
  }

  return { teamA: null, teamB: null };
}
