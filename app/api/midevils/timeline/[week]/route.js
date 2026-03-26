import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { NextResponse } from "next/server";

const WEEKS_DIR = resolve(process.cwd(), "data/midevils/weeks");

export async function GET(_req, { params }) {
  const { week } = await params;

  // Sanitize: only allow YYYY-Wnn format
  if (!/^\d{4}-W\d{2}$/.test(week)) {
    return NextResponse.json({ error: "Invalid week key" }, { status: 400 });
  }

  const filePath = join(WEEKS_DIR, `${week}.json`);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  try {
    const payload = readFileSync(filePath, "utf8");
    return new Response(payload, {
      headers: {
        "Content-Type": "application/json",
        // Cache aggressively — week files are immutable once deployed
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("[midevils/timeline/[week]]", err);
    return NextResponse.json({ error: "Failed to read week data" }, { status: 500 });
  }
}
