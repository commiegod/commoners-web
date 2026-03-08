import { NextResponse } from "next/server";
import { getFile } from "../../../lib/githubApi";

export async function GET() {
  try {
    const { content } = await getFile("data/bracket-2026.json");
    if (!content) {
      return NextResponse.json({ error: "Bracket not found" }, { status: 404 });
    }
    return NextResponse.json(content);
  } catch (err) {
    console.error("bracket GET error:", err);
    return NextResponse.json({ error: "Failed to load bracket" }, { status: 500 });
  }
}
