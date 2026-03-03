import { NextResponse } from "next/server";
import { getFile } from "../../../../lib/githubApi";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { content } = await getFile("data/discussion.json");
    const threads = content?.threads || [];
    const thread = threads.find((t) => t.id === id);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
    return NextResponse.json(thread);
  } catch {
    return NextResponse.json({ error: "Failed to load thread." }, { status: 500 });
  }
}
