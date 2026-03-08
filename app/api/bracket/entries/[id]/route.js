import { NextResponse } from "next/server";
import { getFile } from "../../../../../lib/githubApi";
import { scoreEntry, maxPossibleScore } from "../../../../../lib/bracket";

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const [{ content: bracket }, { content: entriesData }] = await Promise.all([
      getFile("data/bracket-2026.json"),
      getFile("data/bracket-entries.json"),
    ]);

    const entries = entriesData?.entries ?? [];
    const results = bracket?.results ?? {};

    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Score all entries to compute rank
    const scored = entries.map((e) => ({
      id: e.id,
      score: scoreEntry(e.picks, results),
    }));
    scored.sort((a, b) => b.score - a.score);

    const rank = scored.findIndex((e) => e.id === id) + 1;
    const total = entries.length;

    return NextResponse.json({
      ...entry,
      score: scoreEntry(entry.picks, results),
      maxPossible: maxPossibleScore(entry.picks, results),
      rank,
      total,
    });
  } catch (err) {
    console.error("bracket entry GET error:", err);
    return NextResponse.json({ error: "Failed to load entry" }, { status: 500 });
  }
}
