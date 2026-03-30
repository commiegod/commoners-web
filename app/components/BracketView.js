"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getGameTeams, R1_MATCHUPS } from "../../lib/bracket";

const ROUND_LABELS = { 1: "R64", 2: "R32", 3: "S16", 4: "E8" };
const MOBILE_TABS = [
  { key: "east",    label: "East" },
  { key: "west",    label: "West" },
  { key: "south",   label: "South" },
  { key: "midwest", label: "Midwest" },
  { key: "ff",      label: "Final Four" },
];

// ── Team slot ─────────────────────────────────────────────────────────────────

function TeamSlot({ team, gameId, results, picks, onPickChange, mode, eliminatedTeams, pickPct }) {
  if (!team) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs border-b border-border last:border-0 text-muted/40">
        <span className="text-muted/30 w-3 shrink-0" />
        <span className="truncate italic">TBD</span>
      </div>
    );
  }

  const result = results[gameId];
  const pick = picks[gameId];
  const isWinner = result === team.id;
  const isLoser = result && result !== team.id;
  const isEliminated = !result && eliminatedTeams?.has(team.id);
  const isPicked = !result && !isEliminated && pick === team.id;
  const isCorrectPick = result && pick === team.id && result === pick;
  const isWrongPick = result && pick && pick !== result && pick === team.id;
  const isClickable = mode === "pick" && onPickChange && !result && !isEliminated;

  let textClass = "text-foreground";
  if (isEliminated) textClass = "text-muted/35";
  if (isLoser) textClass = "text-muted line-through";
  if (isWinner) textClass = "text-foreground font-semibold";
  if (isCorrectPick) textClass = "text-green-600 font-semibold";
  if (isWrongPick) textClass = "text-red-500 line-through";

  let bgClass = "";
  if (isWinner || isCorrectPick) bgClass = "bg-gold/10";
  else if (isPicked) bgClass = "bg-card";

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 text-xs border-b border-border last:border-0 transition-colors ${bgClass} ${textClass} ${isClickable ? "cursor-pointer hover:bg-card" : ""}`}
      onClick={isClickable ? () => onPickChange(gameId, team.id) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPickChange(gameId, team.id);
              }
            }
          : undefined
      }
    >
      <span className={`w-3 shrink-0 text-right leading-none ${isEliminated ? "text-muted/25" : "text-muted/60"}`}>{team.seed}</span>
      {team.logoUrl && (
        <img src={team.logoUrl} alt="" className={`w-3.5 h-3.5 object-contain shrink-0 ${isEliminated ? "opacity-25 grayscale" : ""}`} aria-hidden="true" />
      )}
      <span className="truncate leading-tight flex-1">{team.name || "TBD"}</span>
      {pickPct != null && (
        <span className="text-muted/40 shrink-0 ml-1">{pickPct}%</span>
      )}
    </div>
  );
}

// ── Single matchup box ────────────────────────────────────────────────────────

function Matchup({ gameId, bracket, results, picks, onPickChange, mode, eliminatedTeams, pickDistribution }) {
  const { teamA, teamB } = getGameTeams(gameId, bracket, results, picks);
  const gameDist = pickDistribution?.[gameId];
  const total = gameDist?.total || 0;
  const pctA = total && teamA ? Math.round(((gameDist[teamA.id] || 0) / total) * 100) : null;
  const pctB = total && teamB ? Math.round(((gameDist[teamB.id] || 0) / total) * 100) : null;
  return (
    <div className="border border-border bg-background min-w-[120px] max-w-[140px] overflow-hidden">
      <TeamSlot team={teamA} gameId={gameId} results={results} picks={picks} onPickChange={onPickChange} mode={mode} eliminatedTeams={eliminatedTeams} pickPct={pctA} />
      <TeamSlot team={teamB} gameId={gameId} results={results} picks={picks} onPickChange={onPickChange} mode={mode} eliminatedTeams={eliminatedTeams} pickPct={pctB} />
    </div>
  );
}

// ── Single round column ───────────────────────────────────────────────────────

function RegionRound({ region, round, count, label, bracket, results, picks, onPickChange, mode, eliminatedTeams, pickDistribution }) {
  const gameIds = [];
  for (let i = 0; i < count; i++) {
    if (round === 1) gameIds.push(`r1_${region}_${i}`);
    else if (round === 2) gameIds.push(`r2_${region}_${i}`);
    else if (round === 3) gameIds.push(`r3_${region}_${i}`);
    else if (round === 4) gameIds.push(`r4_${region}`);
  }

  return (
    <div className="flex flex-col">
      <p className="text-xs text-muted/50 text-center mb-1 tracking-wide shrink-0">{label}</p>
      <div className="flex flex-col justify-around h-[416px]">
        {gameIds.map((gameId) => (
          <Matchup
            key={gameId}
            gameId={gameId}
            bracket={bracket}
            results={results}
            picks={picks}
            onPickChange={onPickChange}
            mode={mode}
            eliminatedTeams={eliminatedTeams}
            pickDistribution={pickDistribution}
          />
        ))}
      </div>
    </div>
  );
}

// ── Full region block (4 rounds) ──────────────────────────────────────────────

function RegionBlock({ regionKey, bracket, results, picks, onPickChange, mode, flip, eliminatedTeams, pickDistribution }) {
  const regionData = bracket.regions[regionKey];
  if (!regionData) return null;

  const rounds = [
    { round: 1, count: 8, label: ROUND_LABELS[1] },
    { round: 2, count: 4, label: ROUND_LABELS[2] },
    { round: 3, count: 2, label: ROUND_LABELS[3] },
    { round: 4, count: 1, label: ROUND_LABELS[4] },
  ];

  const cols = rounds.map(({ round, count, label }) => (
    <RegionRound
      key={round}
      region={regionKey}
      round={round}
      count={count}
      label={label}
      bracket={bracket}
      results={results}
      picks={picks}
      onPickChange={onPickChange}
      mode={mode}
      eliminatedTeams={eliminatedTeams}
      pickDistribution={pickDistribution}
    />
  ));

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted uppercase tracking-widest mb-1 text-center font-medium">
        {regionData.name}
      </p>
      <div className={`flex gap-1 ${flip ? "flex-row-reverse" : "flex-row"}`}>
        {cols}
      </div>
    </div>
  );
}

// ── Final Four game metadata ───────────────────────────────────────────────────
const FF_GAME_INFO = {
  ff_0:  { date: "Apr 4 · 6:09 PM ET",  tv: "TBS/truTV", spread: "ILL -2.5"  },
  ff_1:  { date: "Apr 4 · 8:49 PM ET",  tv: "TBS/truTV", spread: "MICH -1.5" },
  champ: { date: "Apr 7 · 9:20 PM ET",  tv: "CBS" },
};

// ── FF pick split bar ──────────────────────────────────────────────────────────
function FFPickSplit({ gameId, bracket, results, picks, pickDistribution }) {
  const { teamA, teamB } = getGameTeams(gameId, bracket, results, picks);
  const gameDist = pickDistribution?.[gameId];
  const total = gameDist?.total || 0;
  if (!total || !teamA || !teamB) return null;
  const pctA = Math.round(((gameDist[teamA.id] || 0) / total) * 100);
  const pctB = 100 - pctA;
  const nameA = teamA.shortName ?? teamA.name;
  const nameB = teamB.shortName ?? teamB.name;
  return (
    <div className="w-full mt-1">
      <div className="flex justify-between text-[10px] text-muted mb-0.5">
        <span>{nameA} {pctA}%</span>
        <span>{pctB}% {nameB}</span>
      </div>
      <div className="flex h-1.5 rounded overflow-hidden w-full">
        <div className="bg-gold transition-all" style={{ width: `${pctA}%` }} />
        <div className="bg-border transition-all" style={{ width: `${pctB}%` }} />
      </div>
      <p className="text-[9px] text-muted text-center mt-0.5">{total} picks</p>
    </div>
  );
}

// ── Center Final Four + Championship column ───────────────────────────────────

function CenterColumn({ bracket, results, picks, onPickChange, mode, eliminatedTeams, pickDistribution }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 min-w-[172px] max-w-[190px]">

      {/* FF Game 1 */}
      <div className="flex flex-col items-center w-full gap-1">
        <p className="text-xs text-muted tracking-widest uppercase text-center font-semibold">Final Four</p>
        <div className="text-center mb-1">
          <p className="text-[10px] text-muted">{FF_GAME_INFO.ff_0.date}</p>
          <p className="text-[10px] text-muted">{FF_GAME_INFO.ff_0.tv}
            <span className="ml-1.5 text-[10px] text-gold font-semibold">{FF_GAME_INFO.ff_0.spread}</span>
          </p>
        </div>
        <Matchup gameId="ff_0" bracket={bracket} results={results} picks={picks} onPickChange={onPickChange} mode={mode} eliminatedTeams={eliminatedTeams} pickDistribution={pickDistribution} />
        <FFPickSplit gameId="ff_0" bracket={bracket} results={results} picks={picks} pickDistribution={pickDistribution} />
      </div>

      {/* Championship */}
      <div className="flex flex-col items-center w-full gap-1">
        <p className="text-xs text-gold tracking-widest uppercase text-center font-semibold">Championship</p>
        <div className="text-center mb-1">
          <p className="text-[10px] text-muted">{FF_GAME_INFO.champ.date}</p>
          <p className="text-[10px] text-muted">{FF_GAME_INFO.champ.tv}</p>
        </div>
        <Matchup gameId="champ" bracket={bracket} results={results} picks={picks} onPickChange={onPickChange} mode={mode} eliminatedTeams={eliminatedTeams} pickDistribution={pickDistribution} />
        <FFPickSplit gameId="champ" bracket={bracket} results={results} picks={picks} pickDistribution={pickDistribution} />
      </div>

      {/* FF Game 2 */}
      <div className="flex flex-col items-center w-full gap-1">
        <p className="text-xs text-muted tracking-widest uppercase text-center font-semibold">Final Four</p>
        <div className="text-center mb-1">
          <p className="text-[10px] text-muted">{FF_GAME_INFO.ff_1.date}</p>
          <p className="text-[10px] text-muted">{FF_GAME_INFO.ff_1.tv}
            <span className="ml-1.5 text-[10px] text-gold font-semibold">{FF_GAME_INFO.ff_1.spread}</span>
          </p>
        </div>
        <Matchup gameId="ff_1" bracket={bracket} results={results} picks={picks} onPickChange={onPickChange} mode={mode} eliminatedTeams={eliminatedTeams} pickDistribution={pickDistribution} />
        <FFPickSplit gameId="ff_1" bracket={bracket} results={results} picks={picks} pickDistribution={pickDistribution} />
      </div>

    </div>
  );
}

// ── Mobile single-region view ─────────────────────────────────────────────────

function MobileRegionView({ regionKey, bracket, results, picks, onPickChange, mode, eliminatedTeams, pickDistribution }) {
  if (regionKey === "ff") {
    return (
      <div className="overflow-x-auto py-4 px-2">
        <CenterColumn bracket={bracket} results={results} picks={picks} onPickChange={onPickChange} mode={mode} eliminatedTeams={eliminatedTeams} pickDistribution={pickDistribution} />
      </div>
    );
  }
  const regionData = bracket.regions[regionKey];
  if (!regionData) return null;
  // Show region as 4 columns (same as desktop but full-width scrollable)
  const rounds = [
    { round: 1, count: 8, label: ROUND_LABELS[1] },
    { round: 2, count: 4, label: ROUND_LABELS[2] },
    { round: 3, count: 2, label: ROUND_LABELS[3] },
    { round: 4, count: 1, label: ROUND_LABELS[4] },
  ];
  return (
    <div className="overflow-x-auto py-4 px-2">
      <div className="flex gap-1 min-w-max">
        {rounds.map(({ round, count, label }) => (
          <RegionRound
            key={round}
            region={regionKey}
            round={round}
            count={count}
            label={label}
            bracket={bracket}
            results={results}
            picks={picks}
            onPickChange={onPickChange}
            mode={mode}
            eliminatedTeams={eliminatedTeams}
            pickDistribution={pickDistribution}
          />
        ))}
      </div>
    </div>
  );
}

// ── BracketView (exported) ────────────────────────────────────────────────────

function computeEliminatedTeams(bracket, results) {
  const eliminated = new Set();
  for (const [gameId, winnerId] of Object.entries(results)) {
    const { teamA, teamB } = getGameTeams(gameId, bracket, results, {});
    if (teamA && teamA.id !== winnerId) eliminated.add(teamA.id);
    if (teamB && teamB.id !== winnerId) eliminated.add(teamB.id);
  }
  return eliminated;
}

export default function BracketView({
  bracket,
  results = {},
  picks = {},
  onPickChange = null,
  mode = "view",
  fit = false,
  pickDistribution = null,
}) {
  const [activeTab, setActiveTab] = useState("east");
  const eliminatedTeams = bracket ? computeEliminatedTeams(bracket, results) : new Set();
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [innerHeight, setInnerHeight] = useState(null);

  const measure = useCallback(() => {
    if (!containerRef.current || !innerRef.current) return;
    const cw = containerRef.current.offsetWidth;
    const iw = innerRef.current.scrollWidth;
    const ih = innerRef.current.scrollHeight;
    const s = Math.min(1, cw / iw);
    setScale(s);
    setInnerHeight(ih);
  }, []);

  useEffect(() => {
    if (!fit || !containerRef.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    measure();
    return () => ro.disconnect();
  }, [fit, measure]);

  if (!bracket) {
    return <div className="text-muted text-sm py-8 text-center">Loading bracket...</div>;
  }

  return (
    <>
      {/* Mobile: tab navigation */}
      <div className="sm:hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 px-4 py-2.5 text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "text-gold border-b-2 border-gold -mb-px"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <MobileRegionView
          regionKey={activeTab}
          bracket={bracket}
          results={results}
          picks={picks}
          onPickChange={onPickChange}
          mode={mode}
          eliminatedTeams={eliminatedTeams}
          pickDistribution={pickDistribution}
        />
      </div>

      {/* Desktop: full bracket */}
      <div
        ref={fit ? containerRef : undefined}
        className="hidden sm:block"
        style={fit && innerHeight ? { height: innerHeight * scale, overflow: "hidden" } : { overflowX: "auto" }}
      >
        <div
          ref={fit ? innerRef : undefined}
          className="flex flex-row gap-2 min-w-max py-4 px-2"
          style={fit && scale < 1 ? { transformOrigin: "top left", transform: `scale(${scale})` } : undefined}
        >
          {/* Left half: East (top) + South (bottom) */}
          <div className="flex flex-col gap-6">
            <RegionBlock regionKey="east" bracket={bracket} results={results} picks={picks} onPickChange={onPickChange} mode={mode} flip={false} eliminatedTeams={eliminatedTeams} pickDistribution={pickDistribution} />
            <RegionBlock regionKey="south" bracket={bracket} results={results} picks={picks} onPickChange={onPickChange} mode={mode} flip={false} eliminatedTeams={eliminatedTeams} pickDistribution={pickDistribution} />
          </div>

          {/* Center */}
          <CenterColumn bracket={bracket} results={results} picks={picks} onPickChange={onPickChange} mode={mode} eliminatedTeams={eliminatedTeams} pickDistribution={pickDistribution} />

          {/* Right half: West (top) + Midwest (bottom) — mirrored */}
          <div className="flex flex-col gap-6">
            <RegionBlock regionKey="west" bracket={bracket} results={results} picks={picks} onPickChange={onPickChange} mode={mode} flip={true} eliminatedTeams={eliminatedTeams} pickDistribution={pickDistribution} />
            <RegionBlock regionKey="midwest" bracket={bracket} results={results} picks={picks} onPickChange={onPickChange} mode={mode} flip={true} eliminatedTeams={eliminatedTeams} pickDistribution={pickDistribution} />
          </div>
        </div>
      </div>
    </>
  );
}
