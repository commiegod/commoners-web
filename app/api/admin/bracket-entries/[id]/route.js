import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../../lib/githubApi";

function authorized(request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  return token && token === process.env.ADMIN_SECRET;
}

export async function DELETE(request, { params }) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
  }

  try {
    const { content: entriesData, sha } = await getFile("data/bracket-entries.json");
    const entries = entriesData?.entries ?? [];
    const filtered = entries.filter((e) => e.id !== id);

    if (filtered.length === entries.length) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await putFile(
      "data/bracket-entries.json",
      { entries: filtered },
      sha,
      `bracket: delete entry ${id}`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("bracket entry DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
